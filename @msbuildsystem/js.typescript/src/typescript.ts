import {
  declareTask, Task, Reporter, SelfBuildGraph, Target, File,
  Flux, Step, StepWithData, ReduceStepContext,
  resolver, AttributeTypes, AttributePath, util
} from '@msbuildsystem/core';
import { safeSpawnProcess } from '@msbuildsystem/foundation';
import { JSTarget, JSCompilers, NPMInstallTask, NPMLinkTask } from '@msbuildsystem/js';
import { InputData, OutputData } from './worker';
import * as ts from 'typescript'; // don't use the compiler, just use types
import * as path from 'path';
import * as child_process from 'child_process';

@JSCompilers.declare(['typescript', 'ts'])
export class TypescriptCompiler extends SelfBuildGraph<JSTarget> {
  constructor(graph: JSTarget) {
    super({ type: "compiler", name: "typescript" }, graph);
  }

  @resolver(AttributeTypes.validateMergedObjectList)
  tsConfig: ts.CompilerOptions = {};

  @resolver(AttributeTypes.validateMergedObjectList)
  npmInstall: { [s: string]: string } = {};

  @resolver(AttributeTypes.listValidator(AttributeTypes.objectValidator({
    path: { validator: AttributeTypes.validateString, default: undefined },
    name: { validator: AttributeTypes.validateString, default: undefined },
    srcs: { validator: AttributeTypes.validateStringList, default: <string[]>[] }
  })))
  npmLink: { path: string, name: string, srcs: string[] }[] =  [];

  @resolver(Target.validateFile)
  tsMain: File | null = null;

  tsc: TypescriptTask;

  buildGraph(reporter: Reporter) {
    super.buildGraph(reporter);

    let npmInstallForBuild = new NPMInstallTask(this, this.graph.paths.intermediates);
    let tsc = this.tsc = new TypescriptTask({ type: "typescript", name: "tsc" }, this);
    tsc.addDependency(npmInstallForBuild);

    tsc.addFiles(this.graph.files);
    tsc.setOptions(this.tsConfig);
    tsc.setOptions({
      outDir: this.graph.packager.absoluteCompilationOutputDirectory(),
      baseUrl: this.graph.paths.intermediates
    });
    this.tsc.options.paths = this.tsc.options.paths || {};

    // (cwd intermediates & output) npm install
    Object.keys(this.npmInstall).forEach(k => npmInstallForBuild.addPackage(k, this.npmInstall[k]));

    // npm link local dependencies (most of the times this is defined by dependencies that are npm targets)
    this.npmLink.forEach(l =>
      npmInstallForBuild.addDependency(new NPMLinkTask(this,
        File.getShared(path.join(this.graph.paths.output, l.path), true),
        File.getShared(path.join(this.graph.paths.intermediates, l.path), true)
      ))
    );
  }
}

const validator = AttributeTypes.reducedListValidator(AttributeTypes.validateObject, AttributeTypes.createReduceByMergingObjects({ allowMultipleValues: false }));
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
    compilerOptions: validator(reporter, new AttributePath('compilerOptions'), values.map(v => v.compilerOptions)) || {},
    files: Array.from(new Set(([] as string[]).concat(...values.map(v => v.files))))
  }),
  run(f: Flux<ReduceStepContext>, value: TSConfigValue) {
    value.tsconfig.writeUtf8File(JSON.stringify({
        compilerOptions: value.compilerOptions,
        files: value.files
    }, null, 2), (err) => {
      if (err) f.context.reporter.error(err, { type: "error", path: value.tsconfig.path, msg: "unable to write file" });
      f.continue();
    });
  }
});

@declareTask({ type: "typescript" })
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

  isRunRequired(step: StepWithData<{ runRequired?: boolean }, {}, { sources?: string[] }>) {
    if (step.context.sharedData.sources && step.context.sharedData.sources.length) {
      File.ensure(step.context.sharedData.sources.map(h => File.getShared(h)), step.context.lastSuccessTime, {}, (err, required) => {
        step.context.runRequired = !!(err || required);
        step.continue();
      });
    }
    else {
      step.context.runRequired = true;
      step.continue();
    }
  }

  run(step: StepWithData<{}, {}, { sources?: string[] }>) {
    let done = false;
    let process = safeSpawnProcess(path.join(__dirname, 'worker.js'), [], undefined, {}, (err, code, signal, out) => {
      if (err)
        step.context.reporter.error(err);
      else if (signal)
        step.context.reporter.diagnostic({ type: "error", msg: `process terminated with signal ${signal}` });
      else if (code !== 0)
        step.context.reporter.diagnostic({ type: "error", msg: `process terminated with exit code: ${code}` });
      if (out) {
        step.context.reporter.log(out);
      }
      if (!done) {
        done = true;
        step.continue();
      }
    }, 'fork');
    let target = this.target();
    process.on('message', (message: OutputData) => {
      for (let d of message.diagnostics)
        step.context.reporter.diagnostic(d);
      step.context.sharedData.sources = message.sources;
      if (!done) {
        done = true;
        step.continue();
      }
    });
    process.send({
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
