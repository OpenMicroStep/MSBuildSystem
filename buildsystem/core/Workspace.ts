import async = require('./async');
import Target = require('./Target');
import Graph = require('./Graph');
import Task = require('./Task');
import Barrier = require('./Barrier');
import path = require('path');
import _ = require('underscore');
import BuildSession= require('./BuildSession');
import Runner = require('./Runner');

var fs = require('fs-extra');

interface FileInfo {
  file: string;
  tags: Set<string>;
}

interface GroupInfo {
  group: string;
  files: (FileInfo | GroupInfo)[];
}
type FileTree = (FileInfo | GroupInfo)[];

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
  public dependencies: Workspace.Dependency[];
  public runs: Workspace.Run[];
  public error: string;

  constructor(directory) {
    this.directory = directory;
    this.path = path.join(directory, "make.js");
    this.reload();
  }

  reload() {
    this.error = null;
    this.name = "Unnamed";
    this.environments = [];
    this.targets = [];
    this.files = [];
    this.dependencies = [];
    this.runs = [];
    try {
      var Module = require('module');
      var m = new Module(this.path, null);
      m.load(this.path);
      var settings = m.exports;
      this.name = settings.name || "Unnamed";
      this.environments = settings.environments || [];
      this.targets = settings.targets || [];
      this.files = settings.files || [];
      this.dependencies = settings.dependencies || [];
      this.runs = settings.runs || [];
      prepareFiles(this.files);
      this.loadEnvironments();
    }
    catch(e) {
      console.error("reload failed", this.path, e, e.stack);
      this.error = e;
    }
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

  loadEnvironments() {
    var envs = new Map();
    var done = new Set();
    this.environments.forEach((env) => {
      if (env.splitInto) return;
      envs.set(env.name, env);
    });

    var loadenv = (env) => {
      if (done.has(env)) return;
      (env.components || []).forEach((parent) => {
        if ((parent = envs.get(parent))) {
          loadenv(parent);
          _.defaults(env, parent);
        }
      });
      _.defaults(env, {
        directories: {
          publicHeaders: "include",
          target: {
            "Library": "lib",
            "Framework": "framework",
            "Executable": "bin",
            "Bundle": "bundle"
          }
        }
      });
      done.add(env);
    };

    this.environments.forEach((env) => {
      if (env.splitInto) return;
      loadenv(env);
    });
  }

  checkTargetInfo(targetInfo: Workspace.TargetInfo) {
    if(typeof targetInfo.name !== "string")
      throw "'name' must be a string";
     if(typeof targetInfo.type !== "string")
      throw "'type' must be a string";
    if(!Array.isArray(targetInfo.environments))
      throw "'environments' must be an array of strings";
  }

  /** Construct build graph */
  buildGraph(p: async.Async, options: Workspace.BuildGraphOptions) {
    // Build Env/Target dependency graph
    try {
      var root = new RootGraph();
      var targets = options.targets || [];
      var environments = options.environments || [];
      var variants = options.variants || ["debug"];
      var outputdir = options.outputdir || "/opt/microstep/$environment/$variant";
      variants.forEach((variant) => {
        var context = {
          root: root,
          environments: new Map<string, Map<string, Target>>(),
          variant: variant,
          outputdir: outputdir,
        }
        this.targets.forEach((targetInfo) => {
          this.checkTargetInfo(targetInfo);
          if (targets.length && targets.indexOf(targetInfo.name) === -1)
            return;
          targetInfo.environments.forEach((env) => {
            var e = this.environments.find((e) => { return e.name === env });
          });
          this._targetEnvironments(targetInfo).forEach((env) => {
            if (environments.length && environments.indexOf(env.name) === -1)
              return;
            this._buildTargetTask(targetInfo, env, context);
          });
        });
      });

      var runner = new Runner(root, "configure");
      p.context.root = root;
      runner.run(p);
    } catch (e) {
      p.context.error = e;
      p.continue();
    }
  }

  protected _targetEnvironments(targetInfo: Workspace.TargetInfo) : Set<Workspace.Environment> {
    var environments = new Set<any>();
    if (targetInfo.environments) { // the target support a limited list of environments
      var findByName = (name) => {
        var e = this.environments.find((e) => { return e.name === name; });
        if (e && e.splitInto)
            e.splitInto.forEach(findByName);
        else if (e)
            environments.add(e);
      }
      targetInfo.environments.forEach(findByName);
    }
    else { // Target supports all environments
      this.environments.forEach((e) => {
        if (e && !e.splitInto)
          environments.add(e);
      });
    }
    return environments;
  }
  protected _buildTargetTask(targetInfo: Workspace.TargetInfo, env: Workspace.Environment, context: { root: Graph, environments: Map<string, Map<string, Target>>, variant: string, outputdir: string }) : Target {
    try {
      return this.__buildTargetTask.apply(this, arguments);
    } catch(e) {
      if (!(e instanceof Error))
        e = new Error(e);
      e.message = targetInfo.name + " | " + env.name + " | " + context.variant + ": " + e.message;
      throw e;
    }
  }

  protected __buildTargetTask(targetInfo: Workspace.TargetInfo, env: Workspace.Environment, context: { root: Graph, environments: Map<string, Map<string, Target>>, variant: string, outputdir: string }) : Target {
    var targetsInEnv = context.environments.get(env.name);
    if (!targetsInEnv)
      context.environments.set(env.name, targetsInEnv = new Map<string, Target>());
    var target = targetsInEnv.get(targetInfo.name);
    if (!target) {
      console.trace("Building target dependency graph (env=%s, target=%s)", env.name, targetInfo.name);
      var outputdir = context.outputdir.replace('$variant', context.variant).replace('$environment', env.name);
      var options = {
        outputBasePath: outputdir,
        buildpath: path.join(outputdir, ".build"),
        variant: context.variant
      };
      var target = Target.createTarget(context.root, targetInfo, env, this, options);
      if(!target)
        throw new Error("Unable to create target of type " + targetInfo.type);
      targetsInEnv.set(targetInfo.name, target);

      var deps = targetInfo.dependencies || [];
      deps.forEach((dependency) => {
        var dep: any = (typeof dependency === "string") ? {target: dependency} : dependency;
        if (dep.condition && !dep.condition(target))
          return;
        if (!dep.target)
          throw new Error("Dependency must explicitly set the target");

        var depWorkspace: Workspace = this;
        var depEnv = env;
        if (dep.workspace) {
          var depInfo = this.dependencies.find((d) => { return d.name === dep.workspace; });
          if (!depInfo)
            throw new Error(`Dependency workspace '${dep.workspace}' not found`);
          var depPath = depInfo.path;
          if (path.isAbsolute(depPath))
            depWorkspace = Workspace.getShared(depPath);
          else
            depWorkspace = Workspace.getShared(path.join(this.directory, depPath));
          var depEnvName = (depInfo.environments && depInfo.environments[env.name]) || env.name;
          depEnv = depWorkspace.environments.find((e) => { return e.name === depEnvName && !e.splitInto; });
          if (!depEnv)
            throw new Error(`Dependency environment '${depEnvName}' not found for '${dep.workspace}'`);
        }

        var depTargetInfo = depWorkspace.targets.find(function (targetInfo) {
          return targetInfo.name === dep.target;
        });
        if (!depTargetInfo)
          throw new Error("Dependency '" + dep.target + "' not found");
        target.addDependency(depWorkspace._buildTargetTask(depTargetInfo, depEnv, context));
      });
    }
    return target;
  }
}

class RootGraph extends Graph {
  constructor() {
    super({ name: "Root", type: "root" }, null);
  }

  id() {
    return "root";
  }

  storagePath(task: Task) {
    return null;
  }
}

module Workspace {
  export interface BuildGraphOptions {
    targets?: string[],
    environments?: string[],
    variants?: string[],
    outputdir?: string,
  };
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

  export interface Run {
    name: string;
    path: string | { target: string };
    arguments: (string | { target: string })[];
  }

  export interface Environment {
    name: string;
    arch: string;
    platform: string;
    sysroot: string;
    sysrootVersion: string;
    compiler: string;
    linker: string;
    directories: {
      intermediates: string;
      output: string;
      publicHeaders: string;
      target: { [s: string]: string }
    };

    import: string[];
    splitInto: string[];
  }

  export interface Dependency {
    name: string,
    path: string,
    environments: { [s:string]: string },
  }
}

export = Workspace;