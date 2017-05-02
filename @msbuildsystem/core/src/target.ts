import {Project, RootGraph, Reporter, CopyTask,
  AttributePath, AttributeTypes, BuildTargetExportsElement, FileElement,
  Task, Graph, TaskName, BuildTargetElement, File, Directory, util, GenerateFileTask,
  createProviderMap, ProviderMap, InjectionContext,
} from './index.priv';
import * as path from 'path';
import * as fs from 'fs-extra';

function targetValidator<T extends object, A0 extends Target & T>(extensions: AttributeTypes.Extensions<T, A0>) : AttributeTypes.ValidatorT<void, { target: A0, into: any }> {
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
  static registerAttributes<D extends AttributeTypes.Extensions<A, T>, A extends { [K in keyof D]: T[K] }, T extends Target & A>(cstor: { new? (...args) : T, prototype: typeof SelfBuildGraph.prototype }, attributes: AttributeTypes.Extensions<A, T>) {
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

  constructor(name: TaskName, graph: P) {
    super(name, graph);
  }

  resolve(reporter: Reporter, target: Target, path: AttributePath = new AttributePath(target)) {
    this.__validator.validate(reporter, path, target.attributes, { target: target, into: this });
  }

  buildGraph(reporter: Reporter) {}
  configureExports(reporter: Reporter) {}
}
SelfBuildGraph.registerAttributes(SelfBuildGraph as any, {});

export class Target extends SelfBuildGraph<RootGraph> {
  static providers = createProviderMap<{ new (graph: RootGraph, project: Project, attributes: BuildTargetElement): Target }>('targets');
  static register<D extends AttributeTypes.Extensions<A, T>, A extends { [K in keyof D]: T[K] }, T extends Target & A>(names: string[], cstor: { new (graph: RootGraph, project: Project, attributes: BuildTargetElement): T }, attributes: D) {
    SelfBuildGraph.registerAttributes(cstor, attributes);
    Target.providers.register(names, cstor);
  }

  name: { type: "target", name: string, environment: string, project: string };

  dependencies: Set<Target>;
  requiredBy: Set<Target>;

  exports: BuildTargetExportsElement;
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

  copyFiles: FileElement.FileGroup[] = [];
  outputName: string;
  outputFinalName: string | null;

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
    path.push('.', '');
    for (let unused of this.unusedAttributes)
      if (!this.usedAttributes.has(unused))
        path.set(unused).diagnostic(reporter, { type: "warning", msg: `attribute is unused` });
    path.pop(2);
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

Target.register([], Target, {
  outputName:      AttributeTypes.defaultsTo(AttributeTypes.validateString, (t: Target) => t.attributes.name, 'name of target'),
  outputFinalName: AttributeTypes.defaultsTo(AttributeTypes.validateString, null),
  copyFiles:       AttributeTypes.defaultsTo(FileElement.validateFileGroup, []),
});

export namespace Target {
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

