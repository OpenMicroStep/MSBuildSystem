/// <reference path="../../typings/tsd.d.ts" />
/* @flow weak */
//import Workspace = require('./Workspace');
import Workspace = require('./Workspace');
import Task = require('./Task');
import Graph = require('./Graph');
import path = require('path');

var targetClasses = [];
class Target extends Graph {
  info: Workspace.TargetInfo;
  workspace: Workspace;
  env: Workspace.Environment;
  variant: string;
  directories: {intermediates: string; targetOutput: string; output: string};
  modifiers: any[];
  constructor(info: Workspace.TargetInfo, workspace: Workspace, env: Workspace.Environment, variant: string, buildDirectory: string) {
    this.info = info;
    this.workspace = workspace;
    this.env = env;
    this.variant = variant;
    this.directories = {
      intermediates: path.join(buildDirectory, env.directories.intermediates, env.name, info.name),
      targetOutput: path.join(buildDirectory, env.directories.output, env.name, env.directories.target[info.type]),
      output: path.join(buildDirectory, env.directories.output, env.name)
    };
    this.modifiers = [];
    super(this.toString());
  }
  static registerClass(cls, targetTypeName) {
    if(targetTypeName) {
      console.debug("Target '%s' registed (raw name='%s')", targetTypeName, cls.name);
      targetClasses[targetTypeName] = cls;
      cls.prototype.classname = targetTypeName;
    }
  }
  isInstanceOf(classname: string) {
    return (classname in targetClasses && this instanceof targetClasses[classname]);
  }
  static createTarget(info: Workspace.TargetInfo, workspace: Workspace, env: Workspace.Environment, variant: string, buildDirectory: string) {
    var cls: typeof Target= targetClasses[info.type];
    return cls ? new cls(info, workspace, env, variant, buildDirectory) : null;
  }
  toString() {
    return "Target " + this.info.name + ", env=" + this.env.name + ", variant=" + this.variant;
  }

  get targetName(): string { return this.info.name; }

  addTaskModifier(taskTypeName: string, modifier:(target:Target, task: Task) => any) {
    this.modifiers.push(taskTypeName, modifier);
  }
  applyTaskModifiers(task: Task) {
    var err= null;
    for(var i = 0, len = this.modifiers.length - 1; i < len; i += 2) {
      if(task.isInstanceOf(this.modifiers[i])) {
        if ((err= this.modifiers[i + 1].call(this.info, this, task)))
          err= err instanceof Error ? err : new Error(err);
      }
    }
    return err;
  }
  configure(callback: ErrCallback) {
    var err = null;
    if(this.info.configure) {
      if(typeof  this.info.configure !== "function")
        return callback(new Error("'configure' must be a function with 'env' and 'target' arguments"));
      err = this.info.configure(this);
    }
    callback(err);
  }
  exports(targetToConfigure: Target, callback: ErrCallback) {
    if(this.info.exports)
      this._export(this.info.exports, targetToConfigure, callback);
    else
      callback();
  }
  deepExports(targetToConfigure: Target, callback: ErrCallback) {
    if(this.info.deepExports)
      this._export(this.info.deepExports, targetToConfigure, callback);
    else
      callback();
  }
  protected _export(exports: Workspace.TargetExportInfo, targetToConfigure: Target, callback: ErrCallback) {
    var err = null;
    if(exports.configure)
      err = exports.configure.call(this.info, targetToConfigure, this);
    callback(err);
  }
  buildGraph(callback: ErrCallback) {
    this.graph((err, graph) => {
      if (err) return callback(err);
      this.inputs = new Set(graph.inputs);
      this.outputs = new Set(graph.outputs);
      callback();
    });
  }
  protected graph(callback:Graph.BuildGraphCallback) {
    callback(new Error("'graph' must be reimplemented by subclasses"));
  }
}

export = Target;