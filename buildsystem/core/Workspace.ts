/// <reference path="../../typings/tsd.d.ts" />
/* @flow weak */
'use strict';

import Target = require('./Target');
import Graph = require('./Graph');
import Task = require('./Task');
import Barrier = require('./Barrier');
import path = require('path');
import fs = require('fs-extra');
import _ = require('underscore');
import BuildSession= require('./BuildSession');

interface FileInfo {
  file: string;
  tags: Set<string>;
}

interface GroupInfo {
  group: string;
  files: (FileInfo | GroupInfo)[];
}
type FileTree = (FileInfo | GroupInfo)[];

interface BuildGraphContext {
  environments: Map<string, Workspace.EnvironmentTask>;
  targets: Map<string, Target>;
}

interface BuildGraphCallback { (err: Error, graph?: Graph); }

var FILEINFO_NOTAGS = new Set([""]);
function prepareFiles(files: FileTree) {
  for(var file of <any[]>files) {
    if(file.group) {
      if(file.files)
        prepareFiles(file.files);
      else
        file.files = [];
    }
    else if(file.file) {
      if(!file.tags || !file.tags.length)
        file.tags = FILEINFO_NOTAGS;
      else
        file.tags = new Set(file.tags);
    }
  }
}
/**
 * Workspace is the main component of a project
 */
class Workspace {
  public directory:string;
  public path:string;
  public name:string;
  public environments:Workspace.Environment[];
  public targets:Workspace.TargetInfo[];
  public files:FileTree;

  constructor(directory) {
    this.directory = directory;
    this.path = path.join(directory, "make.js");
    this.reload();
  }

  reload() {
    var Module = require('module');
    var m = new Module(this.path, null);
    m.load(this.path);
    var settings = m.exports;
    this.name = settings.name || "Unnamed";
    this.environments = settings.environments || [];
    this.targets = settings.targets || [];
    this.files = settings.files || [];
    prepareFiles(this.files);
  }

  private static workspaces = {};

  /**
   * Get a shared across the whole process file.
   */
  static getShared(workspacePath:string):Workspace {
    workspacePath = path.normalize(workspacePath);
    if (!path.isAbsolute(workspacePath))
      throw "'workspacePath' must be absolute (workspacePath=" + workspacePath + ")";

    var workspace = Workspace.workspaces[workspacePath];
    if (!workspace)
      workspace = Workspace.workspaces[workspacePath] = new Workspace(workspacePath);
    return workspace;
  }

  resolveFiles(queries:string[], absolute: boolean = true):string[] {
    var self = this;

    function findGroupFiles(path:string[], files) {
      if (path.every(function (part) {
          return files.some(function (file) {
            if (file.group === part) {
              files = file.files || [];
              return true;
            }
            return false;
          });
        })) {
        return files;
      }
      return [];
    }

    function keepFile(filters:string[], file: FileInfo) {
      var ret= true;
      var i =0, len= filters.length - 1;
      while(ret && i < len) {
        var t = filters[i++];
        var v = filters[i++];
        if(t === '?') // Must have
          ret= file.tags.has(v);
        else if(t === '') // Must not
          ret= !file.tags.has(v);
      }
      return ret;
    }
    function filterFiles(filters:string[], files:Set<string>, fileTree) {
      fileTree.forEach(function (file) {
        if (file.group)
          filterFiles(filters, files, file.files);
        else if (file.file && keepFile(filters, file)) {
          if (absolute)
            files.add(path.join(self.directory, file.file));
          else
            files.add(file.file);
        }
      });
    }

    var files = new Set<string>();
    queries.forEach(function (query) {
      var filters = query.split(/([?!])/);
      var groupName = filters.shift();
      var fileTree = groupName !== "" ? findGroupFiles(groupName.split('.'), self.files) : self.files;
      filterFiles(filters, files, fileTree);
    });
    return Array.from(files);
  }

  resolveEnvironments(envs:string[]):Workspace.Environment[] {
    var self = this;
    var ret = [];
    envs.forEach(function (env:string) {
      var e;
      if ((e = self.environments[env])) {
        if (_.isArray(e))
          Array.prototype.push.apply(ret, self.resolveEnvironments(e));
        else if (typeof e === "string")
          Array.prototype.push.apply(ret, self.resolveEnvironments([e]));
        else if (_.isObject(e)) {
          if (!e.name) { // environment is not initialized
            e.name = env;
            if (e.parent) {
              var parents = self.resolveEnvironments([e.parent]);
              if (parents.length)
                _.defaults(e, parents[0]);
            }
            _.defaults(e, {
              directories: {
                intermediates: ".intermediates",
                output: "out",
                publicHeaders: "include",
                target: {
                  "Library": "lib",
                  "Framework": "framework",
                  "Executable": "bin",
                  "Bundle": "bundle"
                }
              }
            });
          }
          ret.push(e);
        }
        else
          console.warn("ignoring invalid environment '" + env + "'");
      }
      else {
        console.warn("Couldn't find env " + env);
        console.warn("TODO: create a global environment system");
      }
    });
    return ret;
  }

  checkTargetInfo(targetInfo: Workspace.TargetInfo) {
    if(typeof targetInfo.name !== "string")
      throw "'name' must be a string";
     if(typeof targetInfo.type !== "string")
      throw "'type' must be a string";
    if(!Array.isArray(targetInfo.environments))
      throw "'environments' must be a, array of strings";
  }

  /** Construct build graph */
  buildGraph(options:{targets?: string[]; directory?: string; environments?: string[]; variant?: string[]}) : Promise<Graph> {
    // Build Env/Target dependency graph
    return new Promise((resolve, reject) => {
      try {
        var root = new Workspace.RootTask(options.directory || this.directory);
        var targets = options.targets || [];
        var environments = options.environments || [];
        var variants = options.variant || ["debug"];
        variants.forEach((variant) => {
          var context:BuildGraphContext = {
            environments: new Map<string, Workspace.EnvironmentTask>(),
            targets: new Map<string, Target>(),
          };
          var variantTask = new Workspace.VariantTask(root, variant);
          this.targets.forEach((targetInfo) => {
            this.checkTargetInfo(targetInfo);
            if (targets.length && targets.indexOf(targetInfo.name) === -1)
              return;
            var envs = this.resolveEnvironments(targetInfo.environments);
            envs.forEach((env) => {
              if (environments.length && environments.indexOf(env.name) === -1)
                return;

              var envTask = context.environments.get(env.name);
              if (!envTask)
                context.environments.set(env.name, envTask = new Workspace.EnvironmentTask(variantTask, env));
              this._buildTargetDependencyGraph(context, envTask, targetInfo);
            });
          });
        });

        root.reset();
        root.start(Task.Action.CONFIGURE, () =>  {
          if (root.errors > 0) reject(new Error("Error while configuring"))
          else resolve(root);
        });
      } catch (e) {
        return reject(e);
      }
    });
  }

  protected _buildTargetDependencyGraph(context:BuildGraphContext, envTask:Workspace.EnvironmentTask, targetInfo:Workspace.TargetInfo):Target {
    var key: string, env: Workspace.Environment, target: Target;
    env = envTask.env;
    key = path.join(env.name, this.directory, targetInfo.name);
    if((target= context.targets.get(key)))
      return target;

    console.trace("Building target dependency graph (env=%s, target=%s)", env.name, targetInfo.name);
    target = Target.createTarget(envTask, targetInfo, this);
    if(!target)
      throw("Unable to create target of type " + targetInfo.type);

    // Dependencies
    var deps = targetInfo.dependencies || [];
    deps.forEach((dependency) => {
      var dep: {workspace?: string, target?: string, condition?: (target: Target) => boolean};
      dep = (typeof dependency === "string") ? {target: dependency} : dependency;
      if (dep.condition && !dep.condition(target))
        return;
      if (!dep.target)
        throw("Dependency must explicitly set the target");

      var depWorkspace: Workspace = this;
      if (dep.workspace) {
        if (path.isAbsolute(dep.workspace))
          depWorkspace = Workspace.getShared(dep.workspace);
        else
          depWorkspace = Workspace.getShared(path.join(this.directory, dep.workspace));
      }

      var depTargetInfo = depWorkspace.targets.find(function (targetInfo) {
        return targetInfo.name === dep.target;
      });
      if (!depTargetInfo)
        throw("Dependency '" + dep.target + "' not found");

      target.addDependency(depWorkspace._buildTargetDependencyGraph(context, envTask, depTargetInfo));
    });

    console.trace("Builted  target dependency graph (env=%s, target=%s)", env.name, targetInfo.name);
    context.targets.set(key, target);
    return target;
  }
}

module Workspace {
  export class RootTask extends Graph
  {
    constructor(public directory: string) {
      super("Root", null);
    }
  }
  export class VariantTask extends Graph
  {
    constructor(private root: RootTask, public variant: string) {
      super("Variant " + variant, root);
    }
  }
  export class EnvironmentTask extends Graph
  {
    buildSession: BuildSession;
    output: string;
    intermediates: string;
    inputs:Set<Target>;
    outputs:Set<Target>;
    constructor(private variantTask: VariantTask, public env: Workspace.Environment) {
      super("Environment " + env.name, variantTask);
      this.output = path.join((<RootTask>variantTask.graph).directory, env.directories.output, this.variant, env.name);
      this.intermediates = path.join((<RootTask>variantTask.graph).directory, env.directories.intermediates, this.variant, env.name);
      this.buildSession = new BuildSession.InDatabase(path.join(this.intermediates, "session.nedb"));
    }
    get variant(): string { return (<VariantTask>this.graph).variant; }
    protected runAction(action: Task.Action, buildSession: BuildSession) {
      super.runAction(action, action === Task.Action.CONFIGURE ? buildSession : this.buildSession);
    }
  }
  export interface BuildGraphCallback {
    (err: Error, graph?:Graph): any;
  }
  export interface TargetExportInfo {
    defines: string[];
    frameworks: string[];
    configure?: (other_target:Target, target:Target) => Error;
  }
  export interface TargetInfo {
    name: string;
    outputName?: string;
    type: string;
    environments: string[];
    dependencies?: Array<{
      target: string;
      workspace?:string;
      condition?:(target: Target) => boolean;
      configure?:(target: Target, dep_target: Target) => any
    } | string>;
    files: string[];
    configure?:(target:Target) => Error;
    exports?: TargetExportInfo;
    deepExports?: TargetExportInfo
  }

  export interface Environment {
    name: string;
    arch: string;
    platform: string;
    api: string;
    "api-version": string;
    compiler: string;
    linker: string;
    directories: {
      intermediates: string;
      output: string;
      publicHeaders: string;
      target: { [s: string]: string }
    };
  }
}

export = Workspace;