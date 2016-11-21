import {
  Reporter, SelfBuildGraph, resolver, AttributeTypes, util,
  declareTask, Graph, GenerateFileTask, Step
} from '@msbuildsystem/core';
import {
  ProcessTask, LocalProcessProvider, ProcessProviders
} from '@msbuildsystem/foundation';
import { JSTarget, JSPackagers, JSPackager } from './index';
import * as path from 'path';
import * as child_process from 'child_process';
import * as fs from 'fs';

@JSPackagers.declare(['npm'])
export class NPMPackager extends SelfBuildGraph<JSTarget> implements JSPackager {
  constructor(graph: JSTarget) {
    super({ type: "packager", name: "npm" }, graph);
  }

  @resolver(AttributeTypes.validateMergedObjectList)
  npmInstall: { [s: string]: string } = {};

  @resolver(AttributeTypes.validateMergedObjectList)
  npmPackage: NPMPackage = <NPMPackage>{};

  absoluteModulesOutputDirectory() : string {
    return path.join(this.graph.paths.output, 'node_modules');
  }

  absoluteCompilationOutputDirectory() : string {
    return util.pathJoinIfRelative(this.absoluteModulesOutputDirectory(), this.graph.outputFinalName || this.graph.outputName);
  }

  buildGraph(reporter: Reporter) {
    let npmInstall = new NPMInstallTask(this.graph, this.graph.paths.output);
    Object.keys(this.npmInstall).forEach(k => npmInstall.addPackage(k, this.npmInstall[k]));
    this.graph.compiler.addDependency(npmInstall);
    this.npmPackage.name = this.graph.outputName;
    new NPMGeneratePackage(this, this.npmPackage, path.join(this.absoluteCompilationOutputDirectory(), 'package.json'), this.absoluteModulesOutputDirectory());
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
  constructor(graph: Graph, public info: NPMPackage, path: string, public node_modules: string) {
    super({ type: "npm", name: "package.json" }, graph, path);
  }

  uniqueKeyInfo() : any {
    return this.info;
  }

  generate() : Buffer {
    return new Buffer(JSON.stringify(this.info, null, 2), 'utf8');
  }

  requiredDo(step: Step<{}>) {
    if (step.context.runner.action !== "generate")
      return super.requiredDo(step);

    let ide: string = step.context.runner.options['ide'];
    if (ide !== 'terminal')
      return step.continue();

    let link = path.join(this.target().project.directory, 'node_modules');
    let target = this.node_modules;
    fs.lstat(link, function(err, stats) {
      if (stats && !stats.isSymbolicLink()) {
        step.context.reporter.diagnostic({ type: "error", msg: "file already exists and is not a symbolic link", path: link });
        step.continue();
      }
      else if (stats) {
        fs.readlink(link, function(err, currentTarget) {
          if (err)
            step.context.reporter.error(err, { type: "error", msg: err.message, path: link });
          else if (currentTarget !== target)
            step.context.reporter.diagnostic({ type: "error", msg: `file already exists and is a symbolic link to '${currentTarget}'`, path: link });
          step.continue();
        });
      }
      else {
        fs.symlink(target, link, undefined, (err) => {
          if (err && err.code !== "EEXIST") step.context.reporter.error(err, { type: "error", msg: err.message, path: link });
          step.continue();
        });
      }
    });
  }
}

@declareTask({ type: "npm install" })
export class NPMInstallTask extends ProcessTask {

  constructor(graph: Graph, directory: string) {
    super({ type: "npm", name: "install" }, graph, [], [], { type: "npm" });
    this.addFlags(['install']);
    this.setCwd(directory);
  }

  addPackage(name: string, version: string) {
    this.addFlags([name + '@' + version]);
  }
}

if (ProcessProviders.isOutOfDate) {
  try { // autodetect npm
    let ret = child_process.execSync('npm --version').toString('utf8').trim();
    if (ret)
      ProcessProviders.register(new LocalProcessProvider("npm", { type: "npm", version: ret }));
  } catch (e) {}
}
