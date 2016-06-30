import {Project, RootGraph} from './project';
import {Attributes, AttributeTypes, AttributeResolvers} from './attributes';
import {Task} from './task';
import {Graph} from './graph';
import {BuildTargetElement, targetElementValidator} from './elements/target.element';
import {BuildSession} from './buildSession';
import {File} from './file';
import {Barrier} from './barrier';
import {Step, Reporter} from './runner';
import {Hash} from 'crypto';
import * as path from 'path';
import * as fs from 'fs-extra';

var TargetAttributeResolver = AttributeResolvers.TargetAttributeResolver;
export var targetClasses = new Map<string, typeof Target>();
export function declareTarget(options: { type: string }) {
  return function (constructor: typeof Target) {
    targetClasses.set(options.type, constructor);
  }
}

export function declareResolvers(resolvers: AttributeResolvers.TargetAttributeResolver<any>[]) {
  return function (constructor: { prototype: { resolvers: {[s: string] : AttributeResolvers.Resolver<any>}} }) {
    var prev = constructor.prototype.resolvers;  
    var r = constructor.prototype.resolvers;
    if (!prev || r === prev)
      r = constructor.prototype.resolvers = prev ? Object.assign(resolvers, prev) : {};
    for(var i = 0, len = resolvers.length; i < len; ++i) {
      var resolver = resolvers[i];
      r[resolver.path] = resolver;
    }
  }
}

export function getTargetClass(type: string) : typeof Target {
  return targetClasses.get(type);
}

@declareResolvers([
  new TargetAttributeResolver("targets", new AttributeResolvers.ListResolver(targetElementValidator)),
  new TargetAttributeResolver("configure", new AttributeResolvers.FunctionResolver("(target: Target) => void")),
  new TargetAttributeResolver("exports", new AttributeResolvers.FunctionResolver("(other_target: Target, this_target: Target, lvl: number) => void"))
])
export class Target extends Graph {
  resolvers: {[s: string] : AttributeResolvers.TargetAttributeResolver<any>};
  exportable: {[s: string] : AttributeResolvers.TargetAttributeResolver<any>};
  
  graph: RootGraph;
  dependencies : Set<Target>;
  requiredBy : Set<Target>;
  files: Set<File>;

  project: Project;
  attributes: BuildTargetElement;
  attributesCache: Attributes;
  exportedAttributes: Attributes;
  paths: {
    output: string,
    build: string,
    intermediates: string,
    tasks: string,
  };
  modifiers: ((reporter: Reporter, task: Task) => void)[];

  variant : string;
  environment: string;
  targetName: string;

  constructor(graph: RootGraph, project: Project, attributes: BuildTargetElement, options: {
    outputBasePath: string,
    buildPath: string
  }) {
    super({ type: "target", name: attributes.name, environment: attributes.environment.name, variant: attributes.variant, project: project.path }, graph);

    this.files = new Set<any>();
    this.project = project;
    this.variant = attributes.variant;
    this.targetName = attributes.name;
    this.environment = attributes.environment.name;
    this.attributes = attributes;
    this.attributesCache = {};
    this.exportedAttributes = this.resolvers;
    
    this.modifiers = [];
    this.paths = {
      output       : options.outputBasePath,
      build        : options.buildPath,
      intermediates: path.join(options.buildPath, "intermediates", this.targetName),
      tasks        : path.join(options.buildPath, "tasks")
    };
    fs.ensureDirSync(this.paths.tasks);
  }
      
  uniqueKey(hash: Hash) : boolean {
    hash.update(this.variant + "\t" + this.environment + "\t" + this.targetName);
    return true;
  }
  
  storagePath(task: Task) {
    var id = task.id();
    return id ? this.paths.tasks + '/' + id : null;
  }
  
  do(step: Step) {
    if (step.runner.action === "configure") {
      this.configure(step);
      if (!step.failed) 
        this.buildGraph(step);
      step.continue();
    }
    else
      super.do(step);
  }
  
  resolveDependencies(reporter: Reporter) : string[] {
    return this.resolvers['targets'].resolve(reporter, this);
  }
  
  configure(reporter: Reporter) {
    //let files = this.project.resolveElementValueAndByEnv(reporter, this.attributes, this.attributes.environment, 'files', 'file');
    //for (let file of files)
    //  this.files.add((<any>file).file);
  }
  
  buildGraph(reporter: Reporter) {
  }
  
  configureTask(reporter: Reporter, task: Task) {
    this.modifiers.forEach(function(fn) {
      fn(reporter, task);
    });
  }
    
  private _configureCheckCallMethod(reporter: Reporter, fn: any, method: string, prototype: string) : boolean {
    var ret = false;
    if (!reporter.failed && fn) {
      ret = typeof fn === "function";
      if (!ret) {
        reporter.diagnostic({
          type: "warning",
          msg: `"${method}"" attribute is not defined as a function: ${prototype}`
        });
      }
    }
    return ret;
  }

  configureCallMethod(reporter: Reporter, fn: any, method: string, prototype: string, ...args: any[]) {
    if (!reporter.failed && fn) {
      if (this._configureCheckCallMethod(reporter, fn, method, prototype)) {
        try {
          fn(...args);
        }
        catch (e) {
          reporter.diagnostic({
            type: "error",
            msg: `"${method}" raised an exception`,
            notes: [{
              type: "note",
              msg: e.stack || e
            }]
          });
        }
      }
    }
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
  
  listInputFiles(set: Set<File>) { }
}
