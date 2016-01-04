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
  graph: Workspace.EnvironmentTask;
  info: Workspace.TargetInfo;
  workspace: Workspace;
  intermediates: string;
  output: string;
  modifiers: any[];
  env : Workspace.Environment;
  variant : string;
  targetName: string;
  constructor(envTask: Workspace.EnvironmentTask, info: Workspace.TargetInfo, workspace: Workspace) {
    super({type: "target", name: info.name}, envTask);
    this.info = info;
    this.workspace = workspace;
    this.intermediates = path.join(envTask.intermediates, info.name);
    this.output = path.join(envTask.output, envTask.env.directories.target[this.classname]);
    this.modifiers = [];
    this.env = this.graph.env;
    this.variant = this.graph.variant;
    this.targetName = this.info.name;
  }

  static registerClass(cls, targetTypeName) {
    if(targetTypeName) {
      console.debug("Target '%s' registed (raw name='%s')", targetTypeName, cls.name);
      targetClasses[targetTypeName] = cls;
      cls.prototype.classname = targetTypeName;
    }
  }

  uniqueKey(): string {
    return this.graph.uniqueKey() + "|" + this.name.name;
  }

  isInstanceOf(classname: string) {
    return (classname in targetClasses && this instanceof targetClasses[classname]);
  }
  static createTarget(envTask: Workspace.EnvironmentTask, info: Workspace.TargetInfo, workspace: Workspace) {
    var cls: typeof Target= targetClasses[info.type];
    return cls ? new cls(envTask, info, workspace) : null;
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