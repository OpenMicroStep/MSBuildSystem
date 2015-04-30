var fs = require('fs-extra');
var path = require('path');
var util = require('util');
var Barrier = require('./Barrier');

/**
 * Create a new file
 * @private
 * @param filePath
 * @constructor
 */
function File(filePath) {
  this.path = filePath;
  this.extension = path.extname(this.path);

  this._stats = null;
}

File.prototype.stat = function(cb) {
  if(this._stats) return cb(null, this._stats);
  var self = this;
  fs.stat(this.path, function(err, stats) {
    if(!err)
      self._stats = stats;
    cb(err, stats);
  });
};

File.prototype.unlink = function(cb) {
  fs.unlink(this.path, function(err) {
    if(err && err.code === "ENOENT")
      err = null;
    cb(err);
  });
};

var files = {};

/**
 * Get a shared across the whole process file.
 * @param filePath
 * @return {File}
 */
File.getShared = function(filePath) {
  filePath = path.normalize(filePath);
  if(!path.isAbsolute(filePath))
    throw "'filePath' must be absolute (filePath=" + filePath + ")";

  var file = files[filePath];
  if(!file)
    file = files[filePath] = new File(filePath);
  return file;
};

/**
 * @callback File~ensureCallback
 * @param {string} err
 * @param {boolean} changed
 */
/**
 *
 * @param {object} what
 * @param {[File]} what.inputs
 * @param {[File]} what.outputs
 * @param {File~ensureCallback} callback
 */
File.ensure = function(what, callback) {
  var mtimeInput = 0;
  var mtimeOutput = -1;
  var barrierEnd= Barrier.createSimpleCb(what.inputs.length + what.outputs.length, function(err) {
    if(err) return callback(err);
    callback(null, true); //mtimeInput > mtimeOutput);
  });

  what.inputs.forEach(function(input) {
    input.stat(function(err, stats) {
      if(err) {
        barrierEnd(err);
      }
      else {
        mtimeInput = Math.max(stats['mtime'].getTime(), mtimeInput);
        barrierEnd();
      }
    });
  });

  what.outputs.forEach(function(output) {
    output.stat(function(err, stats) {
      if(err) {
        fs.ensureDir(path.dirname(output.path), function(err) {
          barrierEnd(err);
        });
      }
      else {
        mtimeOutput = Math.min(stats['mtime'].getTime(), mtimeInput);
        barrierEnd();
      }
    });
  });
};


/**
 * Add files to the compilation steps
 * @param {object} options
 * @param {string} options.root
 * @param {string|[string]} params...
 */
File.buildList = function (options, params) {
  var files = [];
  var args = arguments, len = args.length, offset = 0;
  var root = null;
  if(options) {
    root = options.root || null;
    len--;
    offset = 1;
  }
  var paths = new Array(len);

  function nextArg(i) {
    if(i < len) {
      var arg = args[i + offset];
      if(typeof arg === "string") {
        paths[i] = arg;
        nextArg(i + 1);
      }
      else if(util.isArray(arg)) {
        arg.forEach(function(arg) {
          paths[i] = arg;
          nextArg(i + 1);
        });
      }
      else {
        throw "arg must either be an array or a string";
      }
    } else {
      var p = path.join.apply(null, paths);
      if (!path.isAbsolute(p) && root)
        p = path.join(root, p);
      files.push(p);
    }
  }
  nextArg(0);

  return files;
};

module.exports = {
  getShared : File.getShared,
  ensure: File.ensure,
  buildList : File.buildList
};