/// <reference path="../../typings/tsd.d.ts" />
/* @flow weak */
'use strict';

//import Workspace = require('./Workspace');
import Workspace = require('./Workspace');
import Task = require('./Task');
import Graph = require('./Graph');
import BuildSession = require('./BuildSession');
import Barrier = require('./Barrier');
import path = require('path');

var targetClasses = [];
class Target extends Graph {
  dependencies : Set<Target>;
  requiredBy : Set<Target>;
  info: Workspace.TargetInfo;
  workspace: Workspace;
  taskspath: string;
  intermediates: string;
  outputBasePath: string;
  output: string;
  modifiers: any[];
  env : Workspace.Environment;
  variant : string;
  targetName: string;
  constructor(graph: Graph, info: Workspace.TargetInfo, env: Workspace.Environment, workspace: Workspace, options) {
    super({type: "target", name: info.name}, graph);
    this.info = info;
    this.workspace = workspace;
    this.taskspath = options.taskspath;
    this.intermediates = path.join(options.buildpath, env.directories.intermediates, options.variant, env.name);
    this.outputBasePath = path.join(options.buildpath, env.directories.output, options.variant, env.name);
    this.output = path.join(this.outputBasePath, env.directories.target[this.classname]);
    this.modifiers = [];
    this.env = env;
    this.variant = options.variant;
    this.targetName = this.info.name;
  }

  storagePath(task: Task) {
    return this.taskspath + '/' + task.id();
  }

  static registerClass(cls, targetTypeName) {
    if(targetTypeName) {
      console.debug("Target '%s' registed (raw name='%s')", targetTypeName, cls.name);
      targetClasses[targetTypeName] = cls;
      cls.prototype.classname = targetTypeName;
    }
  }

  uniqueKey(): string {
    return this.variant + "\t" + this.env.name + "\t" + this.name.name;
  }

  isInstanceOf(classname: string) {
    return (classname in targetClasses && this instanceof targetClasses[classname]);
  }
  static createTarget(graph: Graph, info: Workspace.TargetInfo, env: Workspace.Environment, workspace: Workspace, options) {
    var cls: typeof Target= targetClasses[info.type];
    return cls ? new cls(graph, info, env, workspace, options) : null;
  }

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

  addDependency(task: Target) {
    super.addDependency(task);
  }

  getDependency(targetName: string) {
    var entries = this.dependencies.values();
    var e: IteratorResult<Target>;
    while(!(e= entries.next()).done) {
      if(e.value.targetName === targetName)
        return e.value;
    }
    return null;
  }
  protected runAction(action: Task.Action) {
    if(action == Task.Action.CONFIGURE) {
      try {
        this.configure((err) => {
          if(err) {
            this.log(err.toString());
            this.end(1);
          }
          else {
            this.buildGraph((err) => {
              if(err) {
                this.log(err.toString());
                this.end(1);
              }
              else {
                this.inputs.forEach((input) => {input.reset();});
                super.runAction(action);
              }
            });
          }
        });
      } catch(e) {
        this.log(e);
        this.end(1);
      }
    }
    else {
      super.runAction(action);
    }
  }
  configure(callback: ErrCallback) {
    var barrier = new Barrier.FirstErrBarrier("Configure " + this.targetName, 1);
    var err = null;
    if(this.info.configure) {
      if(typeof this.info.configure !== "function")
        return callback(new Error("'configure' must be a function with 'env' and 'target' arguments"));
      err = this.info.configure(this);
    }
    barrier.dec(err);
    var exported = new Set<Target>();
    var deepExports = (parent: Target) => {
      parent.dependencies.forEach((dep) => {
        if (!exported.has(dep)) {
          exported.add(dep);
          dep.deepExports(this, barrier.decCallback());
          deepExports(dep);
        }
      });
    };
    this.dependencies.forEach((dep) => {
      dep.exports(this, barrier.decCallback());
    });
    deepExports(this);
    barrier.endWith(callback);
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
    callback();
  }
}

export = Target;