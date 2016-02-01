//import Workspace = require('./Workspace');
import Workspace = require('./Workspace');
import Task = require('./Task');
import Graph = require('./Graph');
import BuildSession = require('./BuildSession');
import Barrier = require('./Barrier');
import path = require('path');
var fs = require('fs-extra');

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
    super({ type: "target", name: info.name, environment: env.name, variant: options.variant, workspace: workspace.path }, graph);
    this.info = info;
    this.workspace = workspace;
    this.taskspath = path.join(options.buildpath, "tasks");
    this.intermediates = path.join(options.buildpath, "intermediates", info.name);
    this.outputBasePath = options.outputBasePath;
    this.output = path.join(this.outputBasePath, env.directories.target[this.classname]);
    this.modifiers = [];
    this.env = env;
    this.variant = options.variant;
    this.targetName = this.info.name;
    fs.ensureDirSync(this.taskspath);
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

  allDependencies() : Set<Target> {
    var set = new Set<Target>();
    var iterate = function(t: Target) {
      if (set.has(t)) return;
      set.add(t);
      t.dependencies.forEach(iterate);
    }
    iterate(this);
    return set;
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
  do(step) {
    if (step.runner.action === "configure") {
      try {
        this.configure((err) => {
          if(err) {
            step.error(err);
            step.continue();
          }
          else {
            this.buildGraph((err) => {
              if(err) {
                step.error(err);
                step.continue();
              }
              else {
                super.do(step);
              }
            });
          }
        });
      } catch(e) {
        step.error(e);
        step.continue();
      }
    }
    else {
      super.do(step);
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