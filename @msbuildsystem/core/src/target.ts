import {Project, RootGraph, Reporter, CopyTask,
  AttributePath, AttributeTypes, TargetExportsDefinition, FileElement,
  Node, Task, Graph, BuildTargetElement, File, Directory, util, GenerateFileTask,
  createProviderMap, ProviderMap, InjectionContext, TaskElement,
} from './index.priv';
import * as path from 'path';
import * as fs from 'fs-extra';

function targetValidator<T extends object, A0 extends Target & T>(extensions: AttributeTypes.ExtensionsNU<T, A0>) : AttributeTypes.ValidatorT<void, { target: A0, into: any }> {
  function validateObject(reporter: Reporter, path: AttributePath, attr: BuildTargetElement, { target, into }:  { target: A0, into: any }) : void {
    Object.getOwnPropertyNames(extensions).forEach(name => target.usedAttributes.add(name));
    AttributeTypes.superValidateObject(reporter, path, attr, target, into, extensions, { validate(reporter: Reporter, at: AttributePath, value: any, a0: string) : undefined {
        if (!attr.__keyMeaning(a0))
          target.unusedAttributes.add(a0);
        return undefined;
      }});
  };
  return { validate: validateObject, traverse: (lvl, ctx) => `object with` };
}

interface TargetValidation {
  __extensions: AttributeTypes.Extension<Partial<Target>, Target>;
  __validator: AttributeTypes.Validator<void, { target: Target, into: any }>;
}

export abstract class SelfBuildGraph<P extends Graph> extends Graph {
  readonly __extensions: AttributeTypes.Extension<Partial<Target>, Target>; // on the prototype
  readonly __validator: AttributeTypes.Validator<void, { target: Target, into: any }>;
  static registerAttributes<T extends SelfBuildGraph<any>, A>(cstor: { prototype: T & A }, attributes: AttributeTypes.ExtensionsNU<A, Target>) {
    let p = cstor.prototype as TargetValidation;
    if (p.hasOwnProperty('__extensions') || p.hasOwnProperty('__validator'))
      throw new Error(`registerAttributes can only be called once per SelfBuildGraph class`);

    let extensions = p.__extensions ? { ...p.__extensions, ...attributes as object } : attributes;
    Object.defineProperties(p, {
      __extensions: { enumerable: false, writable: false, value: extensions },
      __validator: { enumerable: false, writable: false, value: targetValidator(extensions) },
    });
  }
  graph: P;

  constructor(name: Node.Name, graph: P) {
    super(name, graph);
  }

  resolve(reporter: Reporter, target: Target, path: AttributePath = new AttributePath(target)) {
    this.__validator.validate(reporter, path, target.attributes, { target: target, into: this });
  }

  buildGraph(reporter: Reporter) {}
  configureExports(reporter: Reporter) {}
}
SelfBuildGraph.registerAttributes(SelfBuildGraph as any, {});

@Target.declare(['basic'], {
  outputName:      AttributeTypes.defaultsTo(AttributeTypes.validateString, (t: Target) => t.attributes.name, 'name of target'),
  outputFinalName: AttributeTypes.defaultsTo(AttributeTypes.validateString, undefined),
  copyFiles:       AttributeTypes.defaultsTo(FileElement.validateFileGroup, []),
  preTasks:        AttributeTypes.defaultsTo(TaskElement.validateTaskSequence, undefined),
  postsTasks:      AttributeTypes.defaultsTo(TaskElement.validateTaskSequence, undefined),
})
export class Target extends SelfBuildGraph<RootGraph> {
  static providers = createProviderMap<{ new (graph: RootGraph, project: Project, attributes: BuildTargetElement): Target }>('targets');
  static declare<T extends Target, A>(names: string[], attributes: AttributeTypes.ExtensionsNU<A, T> ) {
    return function register(cstor: Target.Constructor<T, A>) {
      Target.register(names, cstor, attributes);
    };
  }
  static register<T extends Target, A>(names: string[], cstor: Target.Constructor<T, A>, attributes: AttributeTypes.ExtensionsNU<A, T>) {
    SelfBuildGraph.registerAttributes(cstor, attributes);
    Target.providers.register(names, cstor);
  }

  name: { type: "target", name: string, environment: string, project: string };

  dependencies: Set<Target>;
  requiredBy: Set<Target>;

  exports: TargetExportsDefinition;
  exportsTask: Target.GenerateExports;
  project: Project;

  attributes: BuildTargetElement;
  usedAttributes = new Set<string>();
  unusedAttributes = new Set<string>();

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

  preTasks: Graph | undefined;
  postsTasks: Graph | undefined;
  copyFiles: FileElement.FileGroup[] = [];
  outputName: string;
  outputFinalName: string | undefined;

  taskCopyFiles?: CopyTask = undefined;


  constructor(graph: RootGraph, project: Project, attributes: BuildTargetElement) {
    super({
      type: "target",
      name: attributes.name,
      environment: attributes.environment.name,
      project: project.path
    }, graph);

    this.project = project;
    this.targetName = attributes.name;
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
    this.exports = this.attributes.exports;
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
    path.push('.', '');
    for (let unused of this.unusedAttributes)
      if (!this.usedAttributes.has(unused))
        path.set(unused).diagnostic(reporter, { type: "warning", msg: `attribute is unused` });
    path.pop(2);
  }

  configureExports(reporter: Reporter) {}

  exportsPath(absolutePath: string) {
    return util.pathRelativeToBase(this.paths.output, absolutePath);
  }

  buildGraph(reporter: Reporter) {
    this.exportsTask = new Target.GenerateExports(this, this.exports, File.getShared(this.project.workspace.pathToSharedExports(this.environment, this.name.name)));
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
  export type Constructor<T extends Target, A> = { new (graph: RootGraph, project: Project, attributes: BuildTargetElement): Target, prototype: T & A };
  export const validateDirectory: AttributeTypes.ValidatorT<Directory, Target> = {
    validate: function validateDirectory(reporter: Reporter, path: AttributePath, value: any, target: Target) : Directory | undefined {
      if (typeof value === "string") {
        let v = AttributeTypes.validateString.validate(reporter, path, value);
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
    },
    traverse: () => `a directory (can be relative to target make.js directory)`
  };

  export class GenerateExports extends GenerateFileTask {
    constructor(graph: Target, public info: any, path: File) {
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

