/// <reference path="../../typings/tsd.d.ts" />
/* @flow weak */
import Target = require('./Target');
import Graph = require('./Graph');
import Task = require('./Task');
import Barrier = require('./Barrier');
import path = require('path');
import fs = require('fs-extra');
import _ = require('underscore');
import BuildSystem = require('../BuildSystem');

interface FileInfo {
  file: string;
  tags: string[];
}

interface GroupInfo {
  group: string;
  files: (FileInfo | GroupInfo)[];
}

interface BuildGraphContext {
  environments: Map<string, EnvironmentTask>;
  directory: string;
  variant: string;
}

interface BuildGraphCallback { (err: Error, graph?: Graph); }

class EnvironmentTask extends Graph
{
  constructor(public env: Workspace.Environment) {
    super("Environment " + env.name);
  }
  addTarget(target: Target) {
    this.inputs.add(target);
    this.outputs.add(target);
  }
  get targets() : Set<Target> {
    return <Set<Target>>this.inputs;
  }
}

/**
 * Workspace is the main component of a project
 */
class Workspace {
  public directory:string;
  public path:string;
  public environments:Workspace.Environment[];
  public targets:Workspace.TargetInfo[];
  public files:FileInfo | GroupInfo;

  constructor(directory) {
    this.directory = directory;
    this.path = path.join(directory, "make.js");
    var settings = require(this.path);

    /**
     * @type {Object.<string, Environment|[string]>}
     */
    this.environments = settings.environments || [];

    /**
     * List of targets with workspace contains
     * @type {[TargetInfo]}
     */
    this.targets = settings.targets || [];

    /**
     * Tree of files
     * @type [GroupInfo|FileInfo]
     */
    this.files = settings.files || [];
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

  resolveFiles(queries:string[]):string[] {
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

    function filterFiles(filters:string[], files:Set<string>, fileTree) {
      fileTree.forEach(function (file) {
        if (file.group) {
          if (file.files)
            filterFiles(filters, files, file.files);
        }
        else if (file.file) {
          if (!filters.length || (file.tags && filters.every(function (filter) {
              return file.tags.indexOf(filter) !== -1;
            }))) {
            files.add(file.file);
          }
        }
      });
    }

    var files = new Set<string>();
    queries.forEach(function (query) {
      var groupName, fileTree;
      var filters = query.split("?");

      fileTree = (groupName = filters.shift()) !== "" ? findGroupFiles(groupName.split('.'), self.files) : self.files;
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
        console.warn("TODO: create a global environment system");
      }
    });
    return ret;
  }

  /** Construct build graph */
  buildGraph(options:{targets?: string[]; directory?: string; environments?: string[]; variant: string}, callback:BuildGraphCallback) {
    var context:BuildGraphContext = {
      environments: new Map<string, EnvironmentTask>(),
      targets: {},
      directory: options.directory || this.directory,
      variant: options.variant || "debug"
    };

    // Build Env/Target dependency graph
    try {
      var targets = options.targets || [];
      var environments = options.environments || [];
      this.targets.forEach((targetInfo) => {
        if (targets.length && targets.indexOf(targetInfo.name) === -1)
          return;
        var envs = this.resolveEnvironments(targetInfo.environments);
        envs.forEach((env) => {
          if (environments.length && environments.indexOf(env.name) === -1)
            return;

          var envTask = context.environments.get(env.name);
          if (!envTask)
            context.environments.set(env.name, envTask = new EnvironmentTask(env));
          this._buildTargetDependencyGraph(context, envTask, targetInfo);
        });
      });
    } catch (e) {
      return callback(e);
    }

    // Build Target tasks graph
    var deep:Target[] = [];
    var configuredTargets = new Set<Target>();
    var configure = function(target: Target, callback:(err?: Error) => any) {
      if(!configuredTargets.has(target)) {
        console.trace("Configuration of %s (env=%s)", target.targetName, target.env.name);
        target.configure(callback);
      }
      else
        callback();
    };
    var buildGraph = function(target: Target, callback:(err?: Error) => any) {
      if(!configuredTargets.has(target)) {
        configuredTargets.add(target);
        console.trace("Building graph of %s (env=%s)", target.targetName, target.env.name);
        target.buildGraph(callback);
      }
      else
        callback();
    };
    var buildTargetTaskGraph = function (target:Target, callback:(err?: Error) => any) {
      configure(target, function(err?: Error) {
        if (err) return callback(err);

        var barrier = new Barrier.FirstErrBarrier("Configure & build graph of " + target.targetName, target.dependencies.size);
        var barrierCb = barrier.decCallback();
        deep.push(target);
        target.dependencies.forEach(function (dep:Target) {
          buildTargetTaskGraph(dep, barrierCb)
        });
        barrier.endWith(function (err?:Error) {
          if (err) return callback(err);
          deep.pop();
          buildGraph(target, function (err?:Error) {
            if (err) return callback(err);

            // call deepExports on non configured targets
            barrier.reset(deep.length);
            deep.forEach((other_target:Target) => {
              if (!configuredTargets.has(other_target)) {
                console.trace("Deep configuration of %s by %s (env=%s)", other_target.targetName, target.targetName, other_target.env.name);
                target.deepExports(other_target, barrierCb);
              }
            });
            barrier.endWith(function (err) {
              if (err) return callback(err);

              // call exports on direct
              var other_target;
              if (deep.length && !configuredTargets.has(other_target= deep[deep.length - 1])) {
                console.trace("Configuration of %s by %s (env=%s)", other_target.targetName, target.targetName, other_target.env.name);
                target.exports(other_target, callback);
              }
              callback();
            });
          });
        });
      });
    };

    var barrier = new Barrier.FirstErrBarrier("Build environments");
    var barrierCb = barrier.decCallback();
    console.debug("Configure targets");
    context.environments.forEach((env) => {
      env.targets.forEach(function (target) {
        barrier.inc();
        buildTargetTaskGraph(target, barrierCb);
      });
    });

    barrier.endWith(function (err) {
      var tasks:Set<Task> = new Set<Task>(context.environments.values());
      callback(err, new Graph("Root", tasks, tasks));
    });
  }

  protected _buildTargetDependencyGraph(context:BuildGraphContext, envTask:EnvironmentTask, targetInfo:Workspace.TargetInfo):Target {
    var env= envTask.env;
    console.trace("Building target dependency graph (env=%s, target=%s)", env.name, targetInfo.name);
    var intermediates = path.join(context.directory, env.directories.intermediates, env.name, targetInfo.name);
    var targetOutput = path.join(context.directory, env.directories.output, env.name, env.directories.target[targetInfo.type]);
    var output = path.join(context.directory, env.directories.output, env.name);
    var TargetConstructor = BuildSystem.Target[targetInfo.type];
    var target: Target = new TargetConstructor(this, targetInfo, {
      intermediates: intermediates,
      output: output,
      targetOutput: targetOutput,
      env: env,
      target:null,
      variant: "debug"
    });
    envTask.addTarget(target);

    // Dependencies
    var deps = targetInfo.dependencies || [];
    deps.forEach((dependency) => {
      var dep:{target: string; workspace:string; condition:(...args:any[]) => any};
      dep = (typeof dependency === "string") ? {target: dependency, workspace: null, condition: null} : dependency;
      if (dep.condition && !dep.condition(target.buildInfo))
        return;
      if (!dep.target)
        throw("Dependency must explicitly set the target");

      var depWorkspace = this;
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

    return target;
  }
}

module Workspace {
  export interface BuildGraphCallback {
    (err: Error, graph?:Graph): any;
  }
  export interface BuildInfo {
    intermediates : string;
    output : string;
    targetOutput : string;
    target : Target;
    env : Environment;
  }
  export interface TargetExportInfo {
    configure?: (other_target:Target, other_env:Environment,target:Target, env:Environment) => Error;
  }
  export interface TargetInfo {
    name: string;
    outputName?: string;
    type: string;
    environments: string[];
    dependencies?: Array<{target: string; workspace:string; condition:(...args: any[]) => any} | string>;
    files: string[];
    configure?:(target:Target, env:Environment) => Error;
    exports?: TargetExportInfo;
    deepExports?: TargetExportInfo
  }
  export interface TargetInfo { // CXXTarget info
    defines: string[];
    frameworks: string[];
    publicHeadersPrefix: string;
    publicHeaders: string[];
    shared: boolean;
    includeDirectoriesOfFiles: boolean;
  }

  export interface Environment {
    name: string;
    arch: string;
    platform: string;
    api: string;
    "api-version": string;
    compiler: string
    directories: {
      intermediates: string;
      output: string;
      target: { [s: string]: string }
    };
  }
}

export = Workspace;