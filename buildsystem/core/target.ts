import {Project, RootGraph} from './project';
import {Attributes, AttributeTypes, AttributeResolvers, AttributePath} from './attributes';
import {Task} from './task';
import {Graph} from './graph';
import {BuildTargetElement, targetElementValidator} from './elements/target.element';
import {FileElement, fileElementValidator} from './elements/file.element';
import {BuildSession} from './buildSession';
import {File} from './file';
import {Barrier} from './barrier';
import {Step, Reporter} from './runner';
import {Hash} from 'crypto';
import * as path from 'path';
import * as fs from 'fs-extra';

export var targetClasses = new Map<string, typeof Target>();
export function declareTarget(options: { type: string }) {
  return function (constructor: typeof Target) {
    targetClasses.set(options.type, constructor);
  }
}

export function getTargetClass(type: string) : typeof Target {
  return targetClasses.get(type);
}

const configureResolver = new AttributeResolvers.FunctionResolver("(target: Target) => void");
const filesResolver = new AttributeResolvers.ListResolver(fileElementValidator)

export class Target extends Graph {
  graph: RootGraph;
  dependencies : Set<Target>;
  requiredBy : Set<Target>;
  files: FileElement[];

  project: Project;
  attributes: BuildTargetElement;
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

    this.files = [];
    this.project = project;
    this.variant = attributes.variant;
    this.targetName = attributes.name;
    this.environment = attributes.environment.name;
    this.attributes = attributes;
    
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
    
  configure(reporter: Reporter) 
  {
    this.resolveAttr(reporter, 'configure', configureResolver, this);
    this.files = this.resolveAttr(reporter, 'files', filesResolver);
  }

  resolveAttr<T>(reporter: Reporter, path: string, resolver: AttributeResolvers.Resolver<T>, ...args) : T
  {
    return resolver.resolve(reporter, this.attributes[path], new AttributePath(path), ...args);
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
