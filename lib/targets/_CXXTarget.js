/* @flow weak */
var Target = require('../core/Target');
var File = require('../core/File');
var CompileTask = require('../tasks/Compile');
var Barrier = require('../core/Barrier');
var Sysroot = require('../core/Sysroot');
var Task = require('../core/Task');
var util = require('util');
var path = require('path');
var _ = require('underscore');

/**
 * Base target for C/C++ targets (library, framework, executable)
 * @constructor
 */
function CXXTarget(workspace, info)
{
  Target.apply(this, arguments);
  this.files = [];
  this.includeDirectories = [];
  this.compileMiddlewares = [];
  this.linkMiddlewares = [];
  /**
   * @type {Sysroot}
   */
  this.sysroot = null;

  if(info.files)
    this.addFiles(workspace.resolveFiles(info.files));
  if(info.defines)
    this.addDefines(info.defines);
  if(info.frameworks)
    this.addFrameworks(info.frameworks);
}

util.inherits(CXXTarget, Target);

CXXTarget.prototype.configure = function(options, callback) {
  var self = this;
  self.sysroot = Sysroot.find(options.env);
  if(!self.sysroot)
    return callback("Unable to find sysroot");
  self.sysroot.configure(options, function(err) {
    if(err) return callback(err);
    Target.prototype.configure.call(self, options, callback);
  });
};

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

CXXTarget.prototype.addLibraries = function(lib0) {
  var libs = _.isArray(lib0) ? lib0 : _.toArray(arguments);
  this.addLinkMiddleware(function(options, task) {
    task.appendArgs(libs);
  });
};

CXXTarget.prototype.addDefines = function() {
  var defines = new Array(arguments.length);
  _.each(arguments, function(v, i) {
    defines[i] = "-D" + v;
  });
  this.addCompileMiddleware(function(options, task) {
    task.appendArgs(defines);
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

/**
 *
 * @param {string|[string]} flags...
 */
CXXTarget.prototype.addCompileFlags = function (flags) {
  if(!Array.isArray(flags))
    flags = _.toArray(arguments);
  this.addCompileMiddleware(function(options, task) {
    task.appendArgs(flags);
  });
};

CXXTarget.prototype.addCompileMiddleware = function (middleware) {
  this.compileMiddlewares.push(middleware);
};
CXXTarget.prototype.addLinkMiddleware = function (middleware) {
  this.linkMiddlewares.push(middleware);
};

/**
 * @param {TargetBuildOptions} options
 * @param {BuildGraphCallback} callback
 */
CXXTarget.prototype.buildCompileGraph = function(options, callback) {
  var self = this;
  var tasks = [];
  var barrier = new Barrier.Simple();
  self.files.forEach(function(srcFile) {
    srcFile = File.getShared(srcFile);
    if(CompileTask.extensions[srcFile.extension]) {
      var objFile = File.getShared(path.join(options.intermediates, path.relative(self.workspace.directory, srcFile.path + ".o")));
      barrier.inc();
      self.sysroot.createCompileTask(options, srcFile, objFile, function(err, task) {
        if(err) return barrier.dec(err);

        self.includeDirectories.forEach(function(dir) { task.appendArgs(["-I" + dir]); });
        self.compileMiddlewares.forEach(function(middleware) { middleware(options, task); });
        tasks.push(task);
        barrier.dec();
      });
    }
  });
  barrier.endWith(function(err) {
    callback(err, new Task.Graph("Compilation", tasks, tasks));
  });
};

CXXTarget.prototype.buildLinkGraph = function(graph, options, callback) {
  var self = this;
  var finalFile = File.getShared(this.sysroot.linkFinalPath(options));
  this.sysroot.createLinkTask(options, graph.outputs, finalFile, function(err, task) {
    if(err) return callback(err);

    self.linkMiddlewares.forEach(function(middleware) { middleware(options, task); });
    graph.outputs= [task];
    callback(null, graph);
  });
};

CXXTarget.prototype.buildLinkFinalName = function(options) {
  return this.name;
};

CXXTarget.prototype.buildLinkFinalPath = function(options) {
  return path.join(options.targetOutput, this.buildLinkFinalName(options));
};

CXXTarget.prototype.buildTaskGraph = function(options, callback) {
  var self = this;
  this.buildCompileGraph(options, function(err, graph) {
    if(err) return callback(err);
    self.buildLinkGraph(graph, options, callback);
  });
};

module.exports = CXXTarget;
