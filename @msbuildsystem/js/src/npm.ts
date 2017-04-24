import {
  Reporter, SelfBuildGraph, resolver, Task, AttributeTypes, util,
  declareTask, Graph, GenerateFileTask, Step, InOutTask, File, Directory,
  ComponentElement, AssociateElement
} from '@openmicrostep/msbuildsystem.core';
import {
  ProcessTask, LocalProcessProvider, ProcessProviders
} from '@openmicrostep/msbuildsystem.foundation';
import { JSTarget, JSPackagers, JSPackager } from './index';
import * as path from 'path';
import * as child_process from 'child_process';
import * as fs from 'fs';

@JSPackagers.declare(['npm'])
export class NPMPackager extends SelfBuildGraph<JSTarget> implements JSPackager {
  constructor(graph: JSTarget) {
    super({ type: "packager", name: "npm" }, graph);
  }

  @resolver(AssociateElement.mergedDynValidator(AttributeTypes.objectValidator))
  npmPackage: NPMPackage = <NPMPackage>{};

  @resolver(AttributeTypes.listValidator(AttributeTypes.objectValidator({
    path: { validator: AttributeTypes.validateString, default: undefined },
    name: { validator: AttributeTypes.validateString, default: undefined },
    srcs: { validator: AttributeTypes.validateStringList, default: <string[]>[] }
  })))
  npmLink: { path: string, name: string, srcs: string[] }[] =  [];

  absoluteModulesOutputDirectory() : string {
    return path.join(this.graph.paths.output, 'node_modules');
  }

  absoluteCompilationOutputDirectory() : string {
    return util.pathJoinIfRelative(this.absoluteModulesOutputDirectory(), this.graph.outputFinalName || this.graph.outputName);
  }

  buildGraph(reporter: Reporter) {
    super.buildGraph(reporter);
    this.npmPackage.name = this.graph.outputName;
    let createPkgJson = new NPMGeneratePackage(this, this.npmPackage, path.join(this.absoluteCompilationOutputDirectory(), 'package.json'));
    let npmInstall = new NPMInstallTask(this, this.absoluteCompilationOutputDirectory());
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

  configureExports(reporter: Reporter) {
    super.configureExports(reporter);
    let exports = this.graph.exports.__createGeneratedComponent('npm');
    let npmLink = [{
      is: "component",
      path: this.graph.exportsPath(this.absoluteCompilationOutputDirectory()),
      name: this.graph.outputName,
      srcs: this.graph.files.map(f => this.graph.exportsPath(f.path))
    }];
    let deps = {
      [this.graph.outputName]: `^${this.npmPackage.version || "0.0.1"}`
    };
    Object.assign(exports, {
      npmPackage: [{ is: "component", dependencies: deps }],
      npmLink: npmLink,
      "peerDependency=": Object.assign(new ComponentElement('component', 'peerDependency', exports), {
        npmPackage: [{ is: "component", peerDependencies: deps }],
        npmLink: npmLink,
      })
    });
  }
}

export interface NPMPackage {
  name: string;
  version?: string;
  description?: string;
  main?: string;
  typings?: string;
  test?: string;
  author?: string;
  license?: string;
  [s: string]: any;
}

@declareTask({ type: "npm package.json" })
export class NPMGeneratePackage extends GenerateFileTask {
  constructor(graph: Graph, public info: NPMPackage, path: string) {
    super({ type: "npm", name: "package.json" }, graph, path);
  }

  uniqueKeyInfo() : any {
    return this.info;
  }

  generate() : Buffer {
    return new Buffer(JSON.stringify(this.info, null, 2), 'utf8');
  }
}


export class NPMTask extends ProcessTask {
  constructor(name: string, graph: Graph, directory: string) {
    super({ type: "npm", name: name }, graph, [], [], { type: "npm" });
    this.setCwd(directory);
  }

  run(step: Step<{}>) {
    let node_modules = File.getShared(path.join(this.cwd, 'node_modules'), true);
    node_modules.ensureDir((err) => {
      if (err) {
        step.context.reporter.error(err);
        step.continue();
      }
      else super.run(step);
    });
  }
}

@declareTask({ type: "npm link" })
export class NPMLinkTask extends InOutTask {

  constructor(graph: Graph, source: Directory, target: Directory) {
    super({ type: "npm", name: "link" }, graph, [source], [target]);
  }

  run(step: Step<{}>) {
    this.outputFiles[0].writeSymlinkOf(step, this.inputFiles[0], true);
  }

}

@declareTask({ type: "npm install" })
export class NPMInstallTask extends NPMTask {
  constructor(graph: Graph, directory: string) {
    super("install", graph, directory);
    this.addFlags(['install']);
  }

  addPackage(name: string, version: string) {
    this.addFlags([name + '@' + version]);
  }

  do_generate_npm(step: Step<{}>) {
    let link = File.getShared(path.join(this.target().project.directory, 'node_modules'), true);
    let target = File.getShared(path.join(this.cwd, 'node_modules'), true);
    link.writeSymlinkOf(step, target, true);
  }
}

ProcessProviders.safeLoadIfOutOfDate('npm', () => {
  let ret = child_process.execSync('npm --version').toString('utf8').trim();
  return ret ? new LocalProcessProvider("npm", { type: "npm", version: ret }) : undefined;
});
