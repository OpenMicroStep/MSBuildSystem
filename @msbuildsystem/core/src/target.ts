import {Project, RootGraph, Reporter,
  AttributePath, AttributeTypes,
  Task, Graph, TaskName, BuildTargetElement, File
} from './index.priv';
import {Hash} from 'crypto';
import * as path from 'path';
import * as fs from 'fs-extra';

export var targetClasses = new Map<string, typeof Target>();
export function declareTarget(options: { type: string }) {
  return function (constructor: typeof Target) {
    constructor.prototype.classname = options.type;
    targetClasses.set(options.type, constructor);
  };
}

export function getTargetClass(type: string) : typeof Target | undefined {
  return targetClasses.get(type);
}

export class PropertyResolver<V extends AttributeTypes.Validator<T, Target>, T> {
  constructor(public validator: V, public attributePath: string, public propertyPath?: string) {}

  resolve(reporter: Reporter, into: SelfBuildGraph<any>, target: Target, path: AttributePath = new AttributePath(target)) : T | undefined {
    let attr = target.attributes[this.attributePath];
    let r: T | undefined = undefined;
    path.push('.', this.attributePath);
    if (attr !== undefined || (this.propertyPath && (r = into[this.propertyPath]) === undefined)) {
      r = this.validator(reporter, path, attr, target);
      if (this.propertyPath && r !== undefined)
        into[this.propertyPath] = r;
    }
    path.pop(2);
    return r;
  }
}

function setupResolvers(prototype: { resolvers: PropertyResolver<any, any>[] }) : PropertyResolver<any, any>[] {
  let p = prototype;
  if (!p.hasOwnProperty('resolvers'))
    p.resolvers = prototype.resolvers ? prototype.resolvers.slice() : [];
  return p.resolvers;
}

export function pushResolvers(prototype: { resolvers: PropertyResolver<any, any>[] }, r: PropertyResolver<any, any>[]) {
  setupResolvers(prototype).push(...r);
}

export function declareResolvers(r: PropertyResolver<any, any>[]) {
  return function installResolvers(cls: { prototype: { resolvers: PropertyResolver<any, any>[] } }) {
    pushResolvers(cls.prototype, r);
  };
}
export function resolver<T>(r: AttributeTypes.Validator<T, Target>, options?: {
  attributePath?: string
 }) {
  return function pushResolverOnProperty(prototype: typeof SelfBuildGraph.prototype, propertyName: string, descriptor?: TypedPropertyDescriptor<T>) {
    setupResolvers(prototype).push(new PropertyResolver(r, (options && options.attributePath) || propertyName, propertyName));
  };
}

export abstract class SelfBuildGraph<P extends Graph> extends Graph {
  readonly resolvers: PropertyResolver<any, any>[]; // on the prototype
  graph: P;

  constructor(name: TaskName, graph: P) {
    super(name, graph);
  }

  resolve(reporter: Reporter, target: Target, path: AttributePath = new AttributePath(target)) {
    for (var r of this.resolvers) {
      r.resolve(reporter, this, target, path);
    }
  }

  buildGraph(reporter: Reporter) {}
}
setupResolvers(SelfBuildGraph.prototype);

const configureResolver = new PropertyResolver<AttributeTypes.Validator<void, Target>, void>(AttributeTypes.functionValidator("(target: Target) => void"), "configure");

export class Target extends SelfBuildGraph<RootGraph> {
  name: { type: "target", name: string, environment: string, variant: string, project: string };

  dependencies: Set<Target>;
  requiredBy: Set<Target>;

  project: Project;
  attributes: BuildTargetElement;
  paths: {
    output: string,
    build: string,
    intermediates: string,
    tasks: string,
  };
  modifiers: ((reporter: Reporter, task: Task) => void)[];

  variant: string;
  environment: string;
  targetName: string;

  @resolver(AttributeTypes.validateString)
  outputName: string;

  @resolver(AttributeTypes.validateString)
  outputFinalName: string | null = null;

  constructor(graph: RootGraph, project: Project, attributes: BuildTargetElement, options: {
    outputBasePath: string,
    buildPath: string
  }) {
    super({
      type: "target",
      name: attributes.name,
      environment: attributes.environment.name,
      variant: attributes.variant,
      project: project.path
    }, graph);

    this.project = project;
    this.variant = attributes.variant;
    this.targetName = attributes.name;
    this.outputName = attributes.name;
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

  __path() {
    return this.attributes.__path();
  }

  uniqueKey(hash: Hash) : boolean {
    hash.update(this.variant + "\t" + this.environment + "\t" + this.targetName);
    return true;
  }

  storagePath(task: Task) {
    var id = task.id();
    return id ? this.paths.tasks + '/' + id : null;
  }

  doConfigure(reporter: Reporter) {
    this.configure(reporter);
    if (!reporter.failed)
      this.buildGraph(reporter);
  }

  configure(reporter: Reporter) {
    let path = new AttributePath(this);
    this.resolve(reporter, this, path);
    configureResolver.resolve(reporter, this, this, path);
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
    };
    iterate(this);
    return set;
  }

  getDependency(targetName: string) {
    var entries = this.dependencies.values();
    var e: IteratorResult<Target>;
    while (!(e = entries.next()).done) {
      if (e.value.targetName === targetName)
        return e.value;
    }
    return null;
  }

  listInputFiles(set: Set<File>) { }
}
