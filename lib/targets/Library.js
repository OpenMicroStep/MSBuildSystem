var path = require('path');
var util = require('util');
var CopyTask = require('../tasks/Copy');
var LinkTask = require('../tasks/LinkTask');
var Target = require('./../core/Target');
var CXXTarget = require('./_CXXTarget');
var File = require('../core/File');
var _ = require('underscore');

function Library()
{
  CXXTarget.apply(this, arguments);
  this.publicHeaders = [];
  this.publicHeadersPrefix = this.name;
  this.publicHeaderMappers = [];
  this.archiveMiddlewares = new Target.Middlewares();

  /**
   * If true, this library will be built as a shared library
   * @type {boolean}
   */
  this.shared = true;
  var self = this;
  this.addCompileMiddleware(function(options, task, next) {
    if(self.shared)
      task.addFlags(["-fPIC"]);
    next();
  });
  this.addLinkMiddleware(function(options, task, next) {
    if(options.toolchain.platform === "darwin")
      task.addFlags(["-dynamiclib"]);
    if(self.shared) {
      task.addFlags(["-fPIC", "-shared"]);
      /*if(options.toolchain.platform === "linux")
        task.addFlags(["-rdynamic"]);*/
    }
    next();
  });
}

util.inherits(Library, CXXTarget);

Library.prototype.buildLinkFinalName = function(options) {
  var name = this.name;
  switch(options.toolchain.platform) {
    case 'darwin':
      name = "lib" + name + (this.shared ? ".dylib" : ".a");
      break;
    case 'linux':
      name = "lib" + name + (this.shared ? ".so"    : ".a");
      break;
    case 'win32':
      name += this.shared ? ".dll"   : ".a";
      break;
  }
  return name;
};

Library.prototype.exports = function(selfOptions, target, targetOptions, callback) {
  target.addIncludeDirectory(this.buildPublicHeaderPath(selfOptions));
  target.addLinkMiddleware(function (options, task, next) {
    task.addFlags(['-L' + selfOptions.targetOutput, '-l' + selfOptions.target.name]);
    next();
  });
  CXXTarget.prototype.exports.call(this, selfOptions, target, targetOptions, callback);
};

Library.prototype.buildLinkFinalPath = function(options) {
  return path.join(options.targetOutput, this.buildLinkFinalName(options));
};

Library.prototype.buildPublicHeaderPath = function(options) {
  return path.join(options.output, options.profile.directories.publicHeaders);
};

Library.prototype.addPublicHeaders = function (headers) {
  var args = _.toArray(arguments);
  args.unshift({root: this.workspace.directory});
  Array.prototype.push.apply(this.publicHeaders, File.buildList.apply(File, args));
};

Library.prototype.setPublicHeadersPrefix = function(prefix) {
  this.publicHeadersPrefix = prefix;
};

Library.prototype.addPublicHeaderMapper = function(mapper) {
  this.publicHeaderMappers.push(mapper);
};

Library.prototype.buildLinkGraph = function(inputs, options, callback) {
  if(this.shared)
    CXXTarget.prototype.buildLinkGraph.call(this, inputs, options, callback);
  else {
    var finalFile = File.getShared(this.buildLinkFinalPath(options));
    var task = new LinkTask(inputs, finalFile, options.toolchain.archiver);
    this.archiveMiddlewares.execute(options, task, function(err) {
      callback(err, inputs, [task]);
    });
  }
};

Library.prototype.buildTaskGraph = function(options, callback) {
  var self = this;
  CXXTarget.prototype.buildTaskGraph.call(this, options, function(err, inputs, outputs) {
    if(err) return callback(err);

    if(self.publicHeaders.length) {
      var copy = new CopyTask();
      self.publicHeaders.forEach(function(inFilename) {
        var outFilename = path.basename(inFilename);
        if(self.publicHeadersPrefix)
          outFilename = path.join(self.publicHeadersPrefix, outFilename);
        self.publicHeaderMappers.forEach(function(mapper){ outFilename = mapper(options, outFilename); });
        outFilename = path.join(self.buildPublicHeaderPath(options), outFilename);
        copy.willCopyFile(inFilename, outFilename);
      });
      inputs.forEach(function(task) { task.addDependency(copy); });
      callback(null, [copy], outputs);
    }
    else {
      callback(null, inputs, outputs);
    }
  });
};

module.exports = Library;
