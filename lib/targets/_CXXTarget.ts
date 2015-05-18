/// <reference path="../../typings/tsd.d.ts" />
// /* @flow weak */
import Target = require('../core/Target');
import Graph = require('../core/Graph');
import File = require('../core/File');
import Workspace = require('../core/Workspace');
import CompileTask = require('../tasks/Compile');
import Barrier = require('../core/Barrier');
import Sysroot = require('../core/Sysroot');
import Task = require('../core/Task');
import util = require('util');
import path = require('path');

/** Base target for C/C++ targets (library, framework, executable) */
class CXXTarget extends Target {
  files = [];
  includeDirectories = [];
  compileMiddlewares = [];
  linkMiddlewares = [];
  sysroot: Sysroot = null;
  outputName: string;
  configure(callback) {
    this.sysroot = Sysroot.find(this.env);
    if (!this.sysroot)
      return callback("Unable to find sysroot");

    if (this.info.files)
      this.addFiles(this.workspace.resolveFiles(this.info.files));
    if (this.info.defines)
      this.addDefines(this.info.defines);
    if (this.info.frameworks)
      this.addFrameworks(this.info.frameworks);
    this.outputName= this.info.outputName || this.info.name;
    this.sysroot.configure(this.buildInfo, (err) => {
      if (err) return callback(err);
      super.configure((err) => {
        if (err) return callback(err);

        if (this.info.includeDirectoriesOfFiles !== false)
          this.addIncludeDirectoriesOfFiles();
        callback();
      });
    });
  }

  addFrameworks(list: string[]) {
    var frameworks = [];
    list.forEach(function (v) {
      frameworks.push("-framework", v);
    });
    this.addLinkMiddleware(function (options, task, next) {
      task.appendArgs(frameworks);
      next();
    })
  }

  addLibraries(libs: string[]) {
    this.addLinkMiddleware(function (options, task) {
      task.appendArgs(libs);
    });
  }

  addDefines(defines: string[]) {
    defines = defines.map(function(def) { return "-D" + def; });
    this.addCompileMiddleware(function (options, task) {
      task.appendArgs(defines);
    })
  }

  addFiles(files : string[]) {
    files.forEach((file) => {
      if(path.isAbsolute(file))
        this.files.push(file);
      else
        this.files.push(path.join(this.workspace.directory, file));
    });
  }

  addIncludeDirectory(dir) {
    this.includeDirectories.push(dir);
  }

  addIncludeDirectoriesOfFiles() {
    var dirs = {};
    this.files.forEach(function (file) {
      var dir = path.dirname(file);
      dirs[dir] = true;
    });
    for (var i in dirs) {
      if (dirs.hasOwnProperty(i))
        this.includeDirectories.push(i);
    }
  }

  addCompileFlags(flags) {
    if (!Array.isArray(flags))
      flags = Array.from(arguments);
    this.addCompileMiddleware(function (options, task) {
      task.appendArgs(flags);
    });
  }

  addCompileMiddleware(middleware) {
    this.compileMiddlewares.push(middleware);
  }

  addLinkMiddleware(middleware) {
    this.linkMiddlewares.push(middleware);
  }

  compileGraph(callback: Graph.BuildGraphCallback) {
    var tasks = new Set<Task>();
    var barrier = new Barrier.FirstErrBarrier("Build compile graph of " +  this.targetName);
    this.files.forEach((srcFile) => {
      srcFile = File.getShared(srcFile);
      if (CompileTask.extensions[srcFile.extension]) {
        var objFile = File.getShared(path.join(this.buildInfo.intermediates, path.relative(this.workspace.directory, srcFile.path + ".o")));
        barrier.inc();
        this.sysroot.createCompileTask(this.buildInfo, srcFile, objFile, (err, task) => {
          if (err) return barrier.dec(err);

          this.includeDirectories.forEach((dir) => {
            (<CompileTask>task).appendArgs(["-I" + dir]);
          });
          this.compileMiddlewares.forEach((middleware) => {
            middleware(this.buildInfo, task);
          });
          tasks.add(task);
          barrier.dec();
        });
      }
    });
    barrier.endWith(function (err) {
      callback(err, new Graph.DetachedGraph(tasks));
    });
  }

  linkGraph(graph: Graph.DetachedGraph, callback: Graph.BuildGraphCallback) {
    var finalFile = File.getShared(this.sysroot.linkFinalPath(this.buildInfo));
    this.sysroot.createLinkTask(this.buildInfo, Array.from(<Iterable<CompileTask>>graph.outputs), finalFile,  (err, task) => {
      if (err) return callback(err);

      this.linkMiddlewares.forEach((middleware) => {
        middleware(this.buildInfo, task);
      });
      callback(null, new Graph.DetachedGraph(graph.inputs, [task]));
    });
  }

  graph(callback: Graph.BuildGraphCallback) {
    this.compileGraph((err, graph) => {
      if (err) return callback(err);
      this.linkGraph(graph, callback);
    });
  }
}
export = CXXTarget;