import {Project, RootGraph, Reporter, CopyTask,
  AttributePath, AttributeTypes, BuildTargetExportsElement, FileElement, ComponentElement,
  Task, Graph, TaskName, BuildTargetElement, File, Directory, util, GenerateFileTask
} from './index.priv';
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

export class PropertyResolver<T> {
  constructor(public validator: AttributeTypes.Validator<T, Target>, public attributePath: string, public propertyPath?: string) {}

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

function setupResolvers(prototype: { resolvers: PropertyResolver<any>[] }) : PropertyResolver<any>[] {
  let p = prototype;
  if (!p.hasOwnProperty('resolvers'))
    p.resolvers = prototype.resolvers ? prototype.resolvers.slice() : [];
  return p.resolvers;
}

function pushResolvers(prototype: { resolvers: PropertyResolver<any>[] }, r: PropertyResolver<any>[]) {
  setupResolvers(prototype).push(...r);
}

export function declareResolvers(r: PropertyResolver<any>[]) {
  return function installResolvers(cls: { prototype: { resolvers: PropertyResolver<any>[] } }) {
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
  readonly resolvers: PropertyResolver<any>[]; // on the prototype
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
  configureExports(reporter: Reporter) {}
}
setupResolvers(SelfBuildGraph.prototype);

const configureResolver = new PropertyResolver<void>(AttributeTypes.functionValidator("(target: Target) => void"), "configure");

export class Target extends SelfBuildGraph<RootGraph> {
  name: { type: "target", name: string, environment: string, project: string };

  dependencies: Set<Target>;
  requiredBy: Set<Target>;

  exports: BuildTargetExportsElement;
  exportsTask: Target.GenerateExports;
  project: Project;
  attributes: BuildTargetElement;
  paths: {
    output: string,
    build: string,
    shared: string,
    intermediates: string,
    tasks: string,
  };
  modifiers: ((reporter: Reporter, task: Task) => void)[];

  environment: string;
  targetName: string;

  @resolver(FileElement.validateFileGroup)
  copyFiles: FileElement.FileGroup[] = [];
  taskCopyFiles?: CopyTask = undefined;

  @resolver(AttributeTypes.validateString)
  outputName: string;

  @resolver(AttributeTypes.validateString)
  outputFinalName: string | null = null;

  constructor(graph: RootGraph, project: Project, attributes: BuildTargetElement) {
    super({
      type: "target",
      name: attributes.name,
      environment: attributes.environment.name,
      project: project.path
    }, graph);

    this.project = project;
    this.targetName = attributes.name;
    this.outputName = attributes.name;
    this.environment = attributes.environment.name;
    this.attributes = attributes;

    this.modifiers = [];
    let build = this.project.workspace.pathToBuild(this.environment);
    this.paths = {
      output       : this.project.workspace.pathToResult(this.environment),
      shared       : this.project.workspace.pathToShared(this.environment),
      build        : build,
      intermediates: path.join(build, "intermediates", this.targetName),
      tasks        : path.join(build, "tasks", this.targetName)
    };
    this.exports = new BuildTargetExportsElement(this, this.attributes.name);
    fs.ensureDirSync(this.paths.tasks);
    fs.ensureDirSync(this.paths.intermediates);
    fs.ensureDirSync(this.paths.output);
  }

  absoluteCopyFilesPath() {
    return this.paths.output;
  }

  __path() {
    return this.attributes.__path();
  }

  uniqueKey() {
    return { environment: this.environment, name: this.targetName };
  }

  storagePath(task: Task) {
    var id = task.id();
    return id ? path.join(this.paths.tasks, id) : undefined;
  }

  configure(reporter: Reporter, path: AttributePath) {
    this.resolve(reporter, this, path);
    configureResolver.resolve(reporter, this, this, path);
  }

  configureExports(reporter: Reporter) {
    this.exports.components.push(...this.attributes.exports);
  }

  exportsPath(absolutePath: string) {
    return util.pathRelativeToBase(this.paths.output, absolutePath);
  }

  buildGraph(reporter: Reporter) {
    this.exportsTask = new Target.GenerateExports(this, this.exports.__serialize(reporter), this.project.workspace.pathToSharedExports(this.environment, this.name.name));
    if (this.copyFiles.length) {
      let copy = this.taskCopyFiles = new CopyTask("copy files", this);
      copy.willCopyFileGroups(reporter, this.copyFiles, this.absoluteCopyFilesPath());
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

export namespace Target {
  export function validateDirectory(reporter: Reporter, path: AttributePath, value: any, target: Target) : Directory | undefined {
    if (typeof value === "string") {
      let v = AttributeTypes.validateString(reporter, path, value);
      if (v !== undefined) {
        v = util.pathJoinIfRelative(target.paths.output, v);
        return File.getShared(v, true);
      }
    }
    else if (value instanceof FileElement) {
      let f = value.__file;
      return f.isDirectory ? f as Directory : f.directory();
    }
    else {
      path.diagnostic(reporter, { type: "warning", msg: "attribute must be a 'file' element or a string" });
    }
    return undefined;
  }
  export function validateFile(reporter: Reporter, path: AttributePath, value: any, target: Target) {
    if (typeof value === "string") {
      let v = AttributeTypes.validateString(reporter, path, value);
      if (v !== undefined) {
        v = util.pathJoinIfRelative(target.paths.output, v);
        return File.getShared(v, false);
      }
    }
    else if (value instanceof FileElement) {
      return value.__file;
    }
    else {
      path.diagnostic(reporter, { type: "warning", msg: "attribute must be a 'file' element or a string" });
    }
    return undefined;
  }

  export class GenerateExports extends GenerateFileTask {
    constructor(graph: Target, public info: any, path: string) {
      super({ type: "exports", name: graph.name.name }, graph, path);
    }

    uniqueKeyInfo() : any {
      return this.info;
    }

    generate() : Buffer {
      return new Buffer(JSON.stringify(this.info, null, 2), 'utf8');
    }
  }
}

