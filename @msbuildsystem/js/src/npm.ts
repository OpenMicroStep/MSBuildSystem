import {
  Reporter, SelfBuildGraph, Task, AttributeTypes, util,
  Graph, GenerateFileTask, Step, InOutTask, File, Directory,
  ComponentElement, AttributePath, Target, FileElement,
} from '@openmicrostep/msbuildsystem.core';
import {
  ProcessTask, LocalProcessProvider, ProcessProviders
} from '@openmicrostep/msbuildsystem.foundation';
import { JSTarget, JSPackagers, JSPackager } from './index';
import * as path from 'path';
import * as child_process from 'child_process';
import * as fs from 'fs';

const npmValidateDeps = AttributeTypes.defaultsTo(ComponentElement.objectValidator({}, AttributeTypes.validateString), {} as { [s: string]: string });
const npmValidate = ComponentElement.objectValidator({
  version:          AttributeTypes.validateString,
  description:      AttributeTypes.defaultsTo(AttributeTypes.validateString, undefined),
  main:             AttributeTypes.defaultsTo(AttributeTypes.validateString, undefined),
  typings:          AttributeTypes.defaultsTo(AttributeTypes.validateString, undefined),
  dependencies:     AttributeTypes.defaultsTo(npmValidateDeps, {}),
  devDependencies:  AttributeTypes.defaultsTo(npmValidateDeps, {}),
  peerDependencies: AttributeTypes.defaultsTo(npmValidateDeps, {}),
}, AttributeTypes.validateAny);
const npmValidateDependencies: AttributeTypes.ValidatorTNU0<NPMPackage.DevDependencies> = ComponentElement.objectValidator({
  dependencies:     npmValidateDeps ,
  devDependencies:  npmValidateDeps ,
  peerDependencies: npmValidateDeps ,
}, AttributeTypes.validateAnyToUndefined);

export abstract class NPMPackager extends SelfBuildGraph<JSTarget> implements JSPackager {
  npmLink: { path: string, name: string, srcs: string[] }[];
  npmPackage: NPMPackage;

  abstract absoluteCompilationOutputDirectory() : string;

  buildGraph(reporter: Reporter) {
    super.buildGraph(reporter);
    this.npmPackage.name = this.graph.outputName;
    let createPkgJson = new NPMGeneratePackage('package.json', this, {
      npmPackage: this.npmPackage,
      dest: File.getShared(path.join(this.absoluteCompilationOutputDirectory(), 'package.json'))
    });
    let npmInstall = new NPMInstallTask("install", this, { directory: File.getShared(this.absoluteCompilationOutputDirectory(), true), packages: {} });
    npmInstall.addDependency(createPkgJson);
    let dependencies = this.npmPackage.dependencies || {};
    for (let link of this.npmLink) {
      let linktask = new NPMLinkTask(this,
        File.getShared(path.join(this.graph.paths.output, link.path), true),
        File.getShared(path.join(this.absoluteCompilationOutputDirectory(), link.path), true)
      );
      linktask.addDependency(createPkgJson);
      npmInstall.addDependency(linktask);
    }
    let ignoreDependencies = new Set<string>(this.npmLink.map(n => n.name));
    for (let key of Object.keys(dependencies)) {
      if (!ignoreDependencies.has(key))
        npmInstall.addPackage(key, dependencies[key]);
    }
  }
}
SelfBuildGraph.registerAttributes(NPMPackager, {
  npmLink: AttributeTypes.defaultsTo(ComponentElement.setAsListValidator(ComponentElement.objectValidator({
    name: AttributeTypes.validateString     ,
    path: AttributeTypes.validateString     ,
    srcs: ComponentElement.setAsListValidator(AttributeTypes.validateString),
  })), []),
  npmPackage: AttributeTypes.defaultsTo(npmValidate, {})
})

export class NPMModule extends NPMPackager {
  constructor(graph: JSTarget) {
    super({ type: "packager", name: "npm" }, graph);
  }

  absoluteModulesOutputDirectory() : string {
    return path.join(this.graph.paths.output, 'node_modules');
  }

  absoluteCompilationOutputDirectory() : string {
    return util.pathJoinIfRelative(this.absoluteModulesOutputDirectory(), this.graph.outputFinalName || this.graph.outputName);
  }

  configureExports(reporter: Reporter) {
    super.configureExports(reporter);
    let exports = { is: 'component', name: 'npm' };
    let npmLink = [{ is: "component",
      path: this.graph.exportsPath(this.absoluteCompilationOutputDirectory()),
      name: this.graph.outputName,
      srcs: [...this.graph.files].map(f => this.graph.exportsPath(f.path))
    }];
    let dependencies = { is: 'component', [this.graph.outputName]: `^${this.npmPackage.version || "0.0.1"}` };
    let npmPackage = { is: 'component', dependencies: dependencies };
    let npmPeerPackage = { is: 'component',  peerDependencies: dependencies };
    Object.assign(exports, {
      npmPackage: npmPackage,
      npmLink: npmLink,
      "peerDependency=": { is: "component",
        npmPackage: npmPeerPackage,
        npmLink: npmLink,
      }
    });
    this.graph.exports["generated="].components.push(exports);
  }
}
JSPackagers.register(['npm'], NPMModule, {});

export class NPMApp extends NPMPackager {
  constructor(graph: JSTarget) {
    super({ type: "packager", name: "npm" }, graph);
  }

  absoluteCompilationOutputDirectory() : string {
    return this.graph.paths.output;
  }
}
JSPackagers.register(['npm-app'], NPMApp, {});

export interface NPMPackage {
  name: string;
  version?: string;
  description?: string;
  main?: string;
  typings?: string;
  test?: string;
  author?: string;
  license?: string;
  dependencies?: { [s: string]: string };
  devDependencies?: { [s: string]: string };
  peerDependencies?: { [s: string]: string };
  [s: string]: any;
}
export namespace NPMPackage {
  export interface DevDependencies {
    dependencies: { [s: string]: string };
    devDependencies: { [s: string]: string };
    peerDependencies: { [s: string]: string };
  }
  export const validate = npmValidate;
  export const validateDevDependencies = npmValidateDependencies;
}

@Task.declare(["npm package.json"], {
  npmPackage: npmValidate,
  dest: AttributeTypes.fallbackTo(FileElement.validateFile, (t: Target) => File.getShared(path.join(t.paths.intermediates, "package-fallback.json"))),
})
export class NPMGeneratePackage extends GenerateFileTask {
  npmPackage: object

  constructor(name: string, graph: Graph, { npmPackage, dest } : { npmPackage: object, dest: File }) {
    super({ type: "npm", name: name }, graph, dest);
    this.npmPackage = npmPackage;
  }

  uniqueKeyInfo() : any {
    return this.npmPackage;
  }

  generate() : Buffer {
    return new Buffer(JSON.stringify(this.npmPackage, null, 2), 'utf8');
  }
}

export class NPMTask extends ProcessTask {
  constructor(name: string, graph: Graph, directory: Directory) {
    super({ type: "npm", name: name }, graph, [], [], { type: "npm" });
    this.setCwd(directory.path);
    this.addFlags(["--loglevel", "info"]);
  }

  do_build(step: Step<{}>) {
    let node_modules = File.getShared(path.join(this.cwd, 'node_modules'), true);
    node_modules.ensureDir((err) => {
      if (err) {
        step.context.reporter.error(err);
        step.continue();
      }
      else super.do_build(step);
    });
  }
}

export class NPMLinkTask extends InOutTask {
  constructor(graph: Graph, source: Directory, target: Directory) {
    super({ type: "npm", name: "link" }, graph, [source], [target]);
  }

  do_build(step: Step<{}>) {
    this.outputFiles[0].writeSymlinkOf(step, this.inputFiles[0], true);
  }
}

@Task.declare(["npm install"], {
  packages: npmValidateDeps,
  directory: Target.validateDirectory,
})
export class NPMInstallTask extends NPMTask {
  constructor(name: string, graph: Graph, { directory, packages } : { directory: Directory, packages: { [s: string]: string } }) {
    super(name, graph, directory);
    this.addFlags(['install']);
    for (let pkg in packages)
      this.addPackage(pkg, packages[pkg]);
  }

  addPackage(name: string, version: string) {
    if (global.process.platform === 'win32' && version.startsWith('^'))
      version = '^^^' + version;
    this.addFlags([name + '@' + version]);
  }

  do_generate_npm(step: Step<{}>) {
    let link = File.getShared(path.join(this.target().project.directory, 'node_modules'), true);
    let target = File.getShared(path.join(this.cwd, 'node_modules'), true);
    link.writeSymlinkOf(step, target, true);
  }
}

ProcessProviders.safeLoadIfOutOfDate('npm', () => {
  let name = global.process.platform === 'win32' ? 'npm.cmd' : 'npm';
  let ret = child_process.execSync(`${name} --version`).toString('utf8').trim();
  return ret ? new LocalProcessProvider(name, { type: "npm", version: ret }) : undefined;
});
