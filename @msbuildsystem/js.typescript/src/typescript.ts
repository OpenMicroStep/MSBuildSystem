import {
  Task, Reporter, SelfBuildGraph, Target, File,
  Flux, Step, StepWithData, ReduceStepContext,
  AttributeTypes as V, AttributePath, util, ComponentElement,
} from '@openmicrostep/msbuildsystem.core';
import { safeSpawnProcess } from '@openmicrostep/msbuildsystem.foundation';
import { JSTarget, JSCompilers, NPMInstallTask, NPMPackage } from '@openmicrostep/msbuildsystem.js';
import { InputData, OutputData } from './worker';
import * as ts from 'typescript'; // don't use the compiler, just use types
import * as path from 'path';
import * as child_process from 'child_process';

export class TypescriptCompiler extends SelfBuildGraph<JSTarget> {
  constructor(graph: JSTarget) {
    super({ type: "compiler", name: "typescript" }, graph);
  }
  tsConfig: ts.CompilerOptions;
  npmLink: { path: string, name: string, srcs: string[] }[];
  npmPackage: NPMPackage.DevDependencies;

  tsc: TypescriptTask;

  buildGraph(reporter: Reporter) {
    super.buildGraph(reporter);

    let npmInstallForBuild = new NPMInstallTask("install", this, {
      directory: File.getShared(this.graph.paths.intermediates, true),
      packages: {},
      links: {},
    });
    let tsc = this.tsc = new TypescriptTask({ type: "typescript", name: "tsc" }, this);
    tsc.addDependency(npmInstallForBuild);

    tsc.addFiles([...this.graph.files]);
    tsc.setOptions(this.tsConfig);
    tsc.setOptions({
      outDir: this.graph.packager.absoluteCompilationOutputDirectory(),
      baseUrl: this.graph.paths.intermediates
    });
    this.tsc.options.paths = this.tsc.options.paths || {};

    // npm link local dependencies (most of the times this is defined by dependencies that are npm targets)
    let ignoreDependencies = new Set<string>(this.npmLink.map(n => n.name));
    for (let l of this.npmLink)
      npmInstallForBuild.addLink(l.name, path.join(this.graph.paths.output, l.path));

    // (cwd intermediates & output) npm install
    Object.keys(this.npmPackage.dependencies).forEach(k => !ignoreDependencies.has(k) && npmInstallForBuild.addPackage(k, this.npmPackage.dependencies[k]));
    Object.keys(this.npmPackage.devDependencies).forEach(k => !ignoreDependencies.has(k) && npmInstallForBuild.addPackage(k, this.npmPackage.devDependencies[k]));
  }
}
JSCompilers.register(['typescript', 'tsc'], TypescriptCompiler, {
  tsConfig: V.defaultsTo<object>(ComponentElement.objectValidator({}, ComponentElement.validateAndNormalizeAny), {}),
  npmLink: V.defaultsTo(ComponentElement.setAsListValidator(ComponentElement.objectValidator({
    name: V.validateString     ,
    path: V.validateString     ,
    srcs: ComponentElement.setAsListValidator(V.validateString),
  })), []),
  npmPackage: V.defaultsTo(NPMPackage.validateDevDependencies, {
    dependencies:     {},
    devDependencies:  {},
    peerDependencies: {},
  }),
});

const validator = V.reducedListValidator(V.validateObject, V.createReduceByMergingObjects({ allowMultipleValues: false }));
export type TSConfigValue = {
  tsconfig: File,
  compilerOptions: ts.CompilerOptions,
  files: string[]
};
Task.generators.register(['tsconfig'], {
  returnValues: false,
  map: (v: TSConfigValue) => v.tsconfig,
  reduce: (reporter: Reporter, values: TSConfigValue[]) : TSConfigValue => ({
    tsconfig: values[0].tsconfig,
    compilerOptions: validator.validate(reporter, new AttributePath('compilerOptions'), values.map(v => v.compilerOptions)) as ts.CompilerOptions || {},
    files: Array.from(new Set(([] as string[]).concat(...values.map(v => v.files))))
  }),
  run(f: Flux<ReduceStepContext>, value: TSConfigValue) {
    value.tsconfig.writeUtf8File(JSON.stringify({
        compilerOptions: value.compilerOptions,
        files: value.files
    }, null, 2), (err) => {
      if (err) f.context.reporter.error(err, { is: "error", path: value.tsconfig.path, msg: "unable to write file" });
      f.continue();
    });
  }
});

export class TypescriptTask extends Task {
  files: File[] = [];
  options: ts.CompilerOptions = {};
  virtualPaths = ["generated", "node_modules"];

  uniqueKey() {
    return {
      files: this.files.map(i => i.path),
      options: this.options
    };
  }

  setOptions(options: ts.CompilerOptions) {
    this.options = Object.assign(this.options, options);
  }

  addFiles(files: File[]) {
    this.files.push(...files);
  }

  // TODO: clean output

  is_build_required(step: StepWithData<{ actionRequired?: boolean }, {}, { sources?: string[], outputs?: string[] }>) {
    let {sources, outputs} = step.context.sharedData;
    step.context.actionRequired = !outputs || !sources;
    step.setFirstElements([
      (step) => {
        if (!step.context.actionRequired && outputs && outputs.length) {
          File.ensure(outputs.map(f => File.getShared(f)), step.context.lastSuccessEndTime, {}, (err, required) => {
            step.context.actionRequired = !!(err || required);
            step.continue();
          });
        }
        else {
          step.continue();
        }
      },
      (step) => {
        if (!step.context.actionRequired && sources && sources.length) {
          File.ensure(sources.map(f => File.getShared(f)), step.context.lastSuccessStartTime, {}, (err, required) => {
            step.context.actionRequired = !!(err || required);
            step.continue();
          });
        }
        else {
          step.continue();
        }
      }
    ]);
    step.continue();
  }


  do_build(step: StepWithData<{}, {}, { sources?: string[], outputs?: string[] }>) {
    let proc = safeSpawnProcess(step, {
      cmd: [path.join(__dirname, 'worker.js')],
      method: 'fork',
    });
    let target = this.target();
    proc.on('message', (message: OutputData) => {
      for (let d of message.diagnostics)
        step.context.reporter.diagnostic(d);
      step.context.sharedData.sources = message.sources;
      step.context.sharedData.outputs = message.outputs;
      proc.send("exit");
    });
    proc.send({
      files: this.files.map(f => f.path),
      intermediatesDirectory: target.paths.intermediates,
      sourceDirectory: target.project.directory,
      outputDirectory: target.paths.output,
      options: this.options,
      virtualPaths: this.virtualPaths,
    } as InputData);
  }

  do_generate_tsconfig(step: Step<{ value: TSConfigValue }>) {
    let dir = File.commonDirectoryPath(this.files);
    let tsconfig = File.getShared(path.join(dir, 'tsconfig.json'));
    let target = this.target();
    let intermediatesDirectory = target.paths.intermediates;
    let options = Object.assign({}, this.options);
    let paths = options.paths || (options.paths = {});
    let baseUrl = options.baseUrl || (options.baseUrl = path.relative(target.project.directory, dir));
    baseUrl = util.pathJoinIfRelative(target.project.directory, baseUrl);
    /*this.npmLink.forEach(l =>
      paths[l.name] = l.srcs
    );*/
    paths['*'] = [path.join(intermediatesDirectory, "/node_modules/*"), path.join(intermediatesDirectory, "/node_modules/@types/*")];
    options.typeRoots = options.typeRoots || [];
    options.typeRoots.push(path.join(intermediatesDirectory, "node_modules/@types"));
    options.rootDirs = options.rootDirs || [];
    options.rootDirs.push(target.project.directory);
    options.rootDirs.push(intermediatesDirectory);
    step.context.value = {
      tsconfig: tsconfig,
      compilerOptions: options,
      files: this.files.map(f => f.relativePath(dir))
    };
    step.continue();
  }
}
