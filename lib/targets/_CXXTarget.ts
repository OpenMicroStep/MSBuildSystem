/// <reference path="../../typings/tsd.d.ts" />
// /* @flow weak */
import Target = require('../core/Target');
import Graph = require('../core/Graph');
import File = require('../core/File');
import Workspace = require('../core/Workspace');
import CompileTask = require('../tasks/Compile');
import LinkTask = require('../tasks/Link');
import Barrier = require('../core/Barrier');
import Sysroot = require('../core/Sysroot');
import Task = require('../core/Task');
import util = require('util');
import path = require('path');

/** Base target for C/C++ targets (library, framework, executable) */
class CXXTarget extends Target {
  files = new Set<string>();
  includeDirectories = new Set<string>();
  sysroot: Sysroot = null;
  outputName: string;
  linkType: CXXTarget.LinkType = CXXTarget.LinkType.EXECUTABLE;
  get arch() { return this.env.arch; }
  get platform() { return this.sysroot.platform; }
  configure(callback) {
    this.sysroot = Sysroot.find(this.env);
    if (!this.sysroot)
      return callback("Unable to find sysroot for " + this.env.name);

    if (this.info.files)
      this.addFiles(this.workspace.resolveFiles(this.info.files));
    if (this.info.defines)
      this.addDefines(this.info.defines);
    if (this.info.frameworks)
      this.addFrameworks(this.info.frameworks);
    this.outputName= this.info.outputName || this.info.name;
    this.sysroot.configure(this, (err) => {
      if (err) return callback(err);
      super.configure((err) => {
        if (err) return callback(err);

        if (Array.isArray(this.info.includeDirectoriesOfFiles))
          this.addIncludeDirectoriesOfFiles(this.workspace.resolveFiles(<string[]>this.info.includeDirectoriesOfFiles));
        else if (this.info.includeDirectoriesOfFiles !== false)
          this.addIncludeDirectoriesOfFiles(this.files);
        callback();
      });
    });
  }
  protected _export(exports: Workspace.TargetExportInfo, targetToConfigure: Target, callback: ErrCallback) {
    super._export(exports, targetToConfigure, (err) => {
      if(err) return callback(err);

      if(targetToConfigure instanceof CXXTarget) {
        if (exports.defines)
          targetToConfigure.addDefines(exports.defines);
        if (exports.frameworks)
          targetToConfigure.addFrameworks(exports.frameworks);
      }
      callback(err);
    });
  }

  addFrameworks(list: string[]) {
    var frameworks = [];
    list.forEach(function (v) {
      frameworks.push("-framework", v);
    });
    this.addLinkFlags(frameworks);
  }

  addLibraries(libs: string[]) {
    this.addTaskModifier('Link', function (target: Target, task: LinkTask) {
      task.addLibraryFlags(libs);
    });
  }

  addDefines(defines: string[]) {
    this.addCompileFlags(defines.map(function(def) { return "-D" + def; }));
  }

  addLinkFlags(flags: string[]) {
    this.addTaskModifier('Link', function (target: Target, task: LinkTask) {
      task.addFlags(flags);
    });
  }

  addCompileFlags(flags: string[]) {
    this.addTaskModifier('Compile', function (target: Target, task: CompileTask) {
      task.addFlags(flags);
    });
  }

  resolvePath(file:string) {
    return path.isAbsolute(file) ? file : path.join(this.workspace.directory, file);
  }

  addFiles(files : string[]) {
    files.forEach((file) => {
      this.files.add(this.resolvePath(file));
    });
  }

  addIncludeDirectory(dir) {
    this.includeDirectories.add(this.resolvePath(dir));
  }

  addIncludeDirectoriesOfFiles(files: Iterable<string>) {
    (<string[]>files).forEach((file) => {
      this.addIncludeDirectory(path.dirname(file));
    });
  }

  compileGraph(callback: Graph.BuildGraphCallback) {
    var tasks = new Set<Task>();
    var barrier = new Barrier.FirstErrBarrier("Build compile graph of " +  this.targetName);
    this.files.forEach((file) => {
      var srcFile = File.getShared(file);
      if (CompileTask.extensions[srcFile.extension]) {
        var objFile = File.getShared(path.join(this.directories.intermediates, path.relative(this.workspace.directory, srcFile.path + ".o")));
        barrier.inc();
        this.sysroot.createCompileTask(this, srcFile, objFile, (err, task) => {
          if (err) return barrier.dec(err);

          this.includeDirectories.forEach((dir) => {
            (<CompileTask>task).addFlags(["-I" + dir]);
          });
          tasks.add(task);
          barrier.dec(this.applyTaskModifiers(task));
        });
      }
    });
    barrier.endWith(function (err) {
      callback(err, new Graph.DetachedGraph(tasks));
    });
  }

  linkGraph(graph: Graph.DetachedGraph, callback: Graph.BuildGraphCallback) {
    var finalFile = File.getShared(this.sysroot.linkFinalPath(this));
    this.sysroot.createLinkTask(this, Array.from(<Iterable<CompileTask>>graph.outputs), finalFile,  (err, task) => {
      if (err) return callback(err);
      callback(this.applyTaskModifiers(task), new Graph.DetachedGraph(graph.inputs, [task]));
    });
  }

  graph(callback: Graph.BuildGraphCallback) {
    this.compileGraph((err, graph) => {
      if (err) return callback(err);
      this.linkGraph(graph, callback);
    });
  }
}
module CXXTarget {
  export enum LinkType {
    STATIC,
    DYNAMIC,
    EXECUTABLE
  }
}

export = CXXTarget;