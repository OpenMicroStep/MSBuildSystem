var path = require('path');
var util = require('util');
var Task = require('../core/Task');
var CopyTask = require('../tasks/Copy');
var LinkTask = require('../tasks/Link');
var Target = require('./../core/Target');
var CXXTarget = require('./_CXXTarget');
var File = require('../core/File');
var _ = require('underscore');

function Library(workspace, info)
{
  CXXTarget.apply(this, arguments);
  this.publicHeaders = [];
  this.publicHeadersPrefix = info.publicHeadersPrefix || this.name;
  this.publicHeaderMappers = [];

  if(info.publicHeaders)
    this.addPublicHeaders(workspace.resolveFiles(info.publicHeaders));

  /**
   * If true, this library will be built as a shared library
   * @type {boolean}
   */
  this.shared = true;
}

util.inherits(Library, CXXTarget);

Library.prototype.type = "library";

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
      name = this.shared ? name + ".dll" : "lib" + name + ".a";
      break;
  }
  return name;
};

Library.prototype.exports = function(selfOptions, target, targetOptions, callback) {
  target.addIncludeDirectory(this.buildPublicHeaderPath(selfOptions));
  target.addLinkMiddleware(function (options, task, next) {
    task.addAfterObjectFlags(['-L' + selfOptions.targetOutput, '-l' + selfOptions.target.name]);
    next();
  });
  CXXTarget.prototype.exports.call(this, selfOptions, target, targetOptions, callback);
};

Library.prototype.buildLinkFinalPath = function(options) {
  return path.join(options.targetOutput, this.buildLinkFinalName(options));
};

Library.prototype.buildPublicHeaderPath = function(options) {
  return path.join(options.output, options.env.directories.publicHeaders);
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

Library.prototype.buildTaskGraph = function(options, callback) {
  var self = this;
  CXXTarget.prototype.buildTaskGraph.call(this, options, function(err, graph) {
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
      graph.addDependency(copy);
      callback(null, new Task.Graph("Copy", [copy], [graph]));
    }
    else {
      callback(null, graph);
    }
  });
};

module.exports = Library;
