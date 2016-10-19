import {Project, RootGraph, Reporter, SelfBuildGraph,
  AttributeResolvers, AttributePath, Task, BuildTargetElement, File
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

export class PropResolver<R extends AttributeResolvers.Resolver<any, Target>> {
  constructor(public resolver: R, public attrPath: string, public clsPath?: string) {}
}

export function getTargetClass(type: string) : typeof Target | undefined {
  return targetClasses.get(type);
}

function setupResolvers(prototype: typeof Target.prototype) : PropResolver<any>[] {
  let p = <{resolvers: PropResolver<any>[]}>prototype;
  if (!p.hasOwnProperty('resolvers'))
    p.resolvers = prototype.resolvers ? prototype.resolvers.slice() : [];
  return p.resolvers;
}

export function pushResolver(prototype: typeof Target.prototype, r: AttributeResolvers.Resolver<any, Target>, attrPath: string, clsPath?: string) {
  let resolvers = setupResolvers(prototype);
  let prop = new PropResolver(r, attrPath, clsPath);
  resolvers.push(prop);
}

export function resolver<T>(r: AttributeResolvers.Resolver<T, Target>, attrPath?: string) {
  return function pushResolverOnProperty(prototype: typeof Target.prototype, propertyName: string, descriptor?: TypedPropertyDescriptor<T>) {
     pushResolver(prototype, r, attrPath || propertyName, propertyName);
  };
}

const configureResolver = new PropResolver(new AttributeResolvers.FunctionResolver("(target: Target) => void"), "configure");

export class Target extends SelfBuildGraph<RootGraph> {
  readonly resolvers: PropResolver<any>[]; // on the prototype

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

  @resolver(AttributeResolvers.stringResolver)
  outputName: string;

  @resolver(AttributeResolvers.stringResolver)
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
    setupResolvers(this.constructor.prototype);

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
    this.resolveAttr(reporter, configureResolver);
    if (!reporter.failed)
      this.buildGraph(reporter);
  }

  configure(reporter: Reporter) {
    for (var r of this.resolvers) {
      this.resolveAttr(reporter, r);
    }
  }

  resolveAttr<T>(reporter: Reporter, prop: PropResolver<AttributeResolvers.Resolver<T, Target>>) : T | undefined {
    let attr = this.attributes[prop.attrPath];
    let r: T | undefined = undefined;
    if (attr !== undefined || (prop.clsPath && (r = this[prop.clsPath]) === undefined)) {
      r = prop.resolver.resolve(reporter, new AttributePath(prop.attrPath), attr, this);
      if (prop.clsPath && r !== undefined)
        this[prop.clsPath] = r;
    }
    return r;
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
