var Target = require('./../core/Target');
var File = require('./../core/File');
var CompileTask = require('./../tasks/CompileTask');
var LinkTask = require('./../tasks/LinkTask');
var util = require('util');
var path = require('path');
var _ = require('underscore');

/**
 * Base target for C/C++ targets (library, framework, executable)
 * @constructor
 */
function CXXTarget()
{
  Target.apply(this, arguments);
  this.files = [];
  this.includeDirectories = [];
  this.compileMiddlewares = new Target.Middlewares();
  this.linkMiddlewares = new Target.Middlewares();
}

util.inherits(CXXTarget, Target);

CXXTarget.prototype.addFrameworks = function() {
  var defines = new Array(arguments.length * 2);
  _.each(arguments, function(v, i) {
    defines[i * 2    ] = "-framework";
    defines[i * 2 + 1] = v;
  });
  this.addLinkMiddleware(function(options, task, next) {
    task.addFlags(defines);
    next();
  })
};

CXXTarget.prototype.addDefines = function() {
  var defines = new Array(arguments.length);
  _.each(arguments, function(v, i) {
    defines[i] = "-D" + v;
  });
  this.addCompileMiddleware(function(options, task, next) {
    task.addFlags(defines);
    next();
  })
};
CXXTarget.prototype.addFiles = function (files) {
  var args = _.toArray(arguments);
  args.unshift({root: this.workspace.directory});
  Array.prototype.push.apply(this.files, File.buildList.apply(File, args));
};

CXXTarget.prototype.addIncludeDirectory = function(dir) {
  this.includeDirectories.push(dir);
};

CXXTarget.prototype.addIncludeDirectoriesOfFiles = function() {
  var dirs = {};
  this.files.forEach(function(file) {
    var dir = path.dirname(file);
    dirs[dir] = true;
  });
  for(var i in dirs) {
    if(dirs.hasOwnProperty(i))
      this.includeDirectories.push(i);
  }
};

CXXTarget.prototype.addCompileMiddleware = function (middleware) {
  this.compileMiddlewares.add(middleware);
};
CXXTarget.prototype.addLinkMiddleware = function (middleware) {
  this.linkMiddlewares.add(middleware);
};

/**
 * @param {TargetBuildOptions} options
 * @param {BuildGraphCallback} callback
 */
CXXTarget.prototype.buildCompileGraph = function(options, callback) {
  var middleware = 1;
  function addTask(err) {
    if(err) {
      middleware = 0;
      callback(err);
    }
    else if(--middleware === 0) {
      callback(null, tasks, tasks);
    }
  }

  var self = this;
  var tasks = [];
  self.files.forEach(function(srcFile) {
    srcFile = File.getShared(srcFile);
    if(CompileTask.extensions[srcFile.extension]) {
      var objFilePath = path.join(options.intermediates, path.relative(self.workspace.directory, srcFile.path + ".o"));
      var objFile = File.getShared(objFilePath);
      var task = new CompileTask(srcFile, objFile, options.toolchain.compiler);
      self.includeDirectories.forEach(function(dir) { task.addFlags(["-I" + dir]); });
      ++middleware;
      self.compileMiddlewares.execute(options, task, addTask);
      tasks.push(task);
    }
  });
  addTask(null);
};

CXXTarget.prototype.buildLinkGraph = function(inputs, options, callback) {
  var finalFile = File.getShared(this.buildLinkFinalPath(options));
  var task = new LinkTask(inputs, finalFile, options.toolchain.linker);
  this.linkMiddlewares.execute(options, task, function(err) {
    callback(err, inputs, [task]);
  });
};

CXXTarget.prototype.buildLinkFinalPath = function(options) {
  return path.join(options.targetOutput, this.name);
};

CXXTarget.prototype.buildTaskGraph = function(options, callback) {
  var self = this;
  this.buildCompileGraph(options, function(err, inputs, outputs) {
    if(err) return callback(err);
    self.buildLinkGraph(inputs, options, callback);
  });
};

module.exports = CXXTarget;
