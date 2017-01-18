import { declareTask, Task, Reporter, SelfBuildGraph, Target, File, Step, StepWithData, resolver, AttributeTypes, util, generator } from '@msbuildsystem/core';
import { JSTarget, JSCompilers, NPMInstallTask, NPMLinkTask } from '@msbuildsystem/js';
import * as ts from 'typescript'; // don't use the compiler, just use types
import * as path from 'path';

const mapCategory = new Map<ts.DiagnosticCategory, 'warning' | 'error' | 'note'>();
mapCategory.set(ts.DiagnosticCategory.Warning, 'warning');
mapCategory.set(ts.DiagnosticCategory.Error, 'error');
mapCategory.set(ts.DiagnosticCategory.Message, 'note');

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
    let npmInstall = new NPMInstallTask(this.graph, this.graph.paths.intermediates);
    let npmInstallOut = new NPMInstallTask(this.graph, this.graph.paths.output);
    Object.keys(this.npmInstall).forEach(k => npmInstall.addPackage(k, this.npmInstall[k]));
    Object.keys(this.npmInstall).forEach(k => npmInstallOut.addPackage(k, this.npmInstall[k]));
    this.npmLink.forEach(l =>
      npmInstall.addDependency(new NPMLinkTask(this.graph,
        File.getShared(path.join(this.graph.paths.output, l.path), true),
        File.getShared(path.join(this.graph.paths.intermediates, l.path), true)
      ))
    );
    this.graph.compiler.addDependency(npmInstall);
    let tsc = this.tsc = new TypescriptTask({ type: "typescript", name: "tsc" }, this);
    tsc.addFiles(this.graph.files);
    tsc.setOptions(this.tsConfig);
    tsc.setOptions({
      outDir: this.graph.packager.absoluteCompilationOutputDirectory(),
      //rootDir: path.join(this.graph.paths.intermediates, this.tsConfig.rootDir),
      baseUrl: this.graph.paths.intermediates
    });
    this.tsc.options.paths = this.tsc.options.paths || {};
    new NPMLinkTask(this.graph,
      File.getShared(path.join(this.graph.paths.intermediates, "node_modules"), true),
      File.getShared(path.join(this.graph.packager.absoluteCompilationOutputDirectory(), "node_modules"), true)
    );
  }



  @generator
  do_generate_tsconfig(step: Step<{}>) {
    let dir = File.commonDirectoryPath(this.tsc.files);
    let tsconfig = File.getShared(path.join(dir, 'tsconfig.json'));
    tsconfig.ensureDir((err) => {
      if (err) {
        step.context.reporter.error(err, { type: "error", path: tsconfig.path, msg: "unable to create directory for writing file" });
        step.continue();
      }
      else {
        let target = this.target();
        let intermediatesDirectory = target.paths.intermediates;
        let options = Object.assign({}, this.tsConfig);
        let paths = options.paths || (options.paths = {});
        let baseUrl = options.baseUrl || (options.baseUrl = path.relative(target.project.directory, dir));
        baseUrl = util.pathJoinIfRelative(target.project.directory, baseUrl);
        this.npmLink.forEach(l =>
          paths[l.name] = l.srcs
        );
        paths['*'] = [path.join(intermediatesDirectory, "/node_modules/*"), path.join(intermediatesDirectory, "/node_modules/@types/*")];
        options.typeRoots = options.typeRoots || [];
        options.typeRoots.push(path.join(intermediatesDirectory, "node_modules/@types"));
        tsconfig.writeUtf8File(JSON.stringify({
           compilerOptions: options,
           files: this.tsc.files.map(f => f.relativePath(dir))
        }, null, 2), (err) => {
          if (err) step.context.reporter.error(err, { type: "error", path: tsconfig.path, msg: "unable to write file" });
          step.continue();
        });
      }
    });
  }
}

export type CompilerHostWithVirtualFS = ts.CompilerHost & {
  fromVirtualFs(p: string) : string,
  toVirtualFs(p: string) : string,
  isInVirtualFs(p: string) : boolean
};

@declareTask({ type: "typescript" })
export class TypescriptTask extends Task {
  files: File[] = [];
  options: ts.CompilerOptions = {};
  nonVirtualPaths = ["generated", "node_modules"];

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

  // TODO: incremental build
  // TODO: clean output
  // TODO: async run (slower startup with tsc or create and use a worker API)

  // we have to create a custom compiler host to fix out of src directory limitations
  createCompilerHost(options: ts.CompilerOptions) : CompilerHostWithVirtualFS {
    let target = this.target();
    let workspaceDir = target.project.workspace.directory;
    let sourceDirectory = target.project.directory;
    let intermediatesDirectory = target.paths.intermediates;
    let isInVirtualFs = new RegExp(`^${util.escapeRegExp(intermediatesDirectory)}/(?!(${this.nonVirtualPaths.map(p => util.escapeRegExp(p)).join('|')})(/|$))`, 'i');
    let host = ts.createCompilerHost(options);
    function fromVirtualFs(p: string) {
      if (isInVirtualFs.test(p))
        p = path.join(sourceDirectory, p.substring(intermediatesDirectory.length + 1));
      return p;
    }
    function toVirtualFs(p: string) {
      if (p.startsWith(sourceDirectory) && !p.startsWith(workspaceDir))
        p = path.join(intermediatesDirectory, path.relative(sourceDirectory, p));
      return p;
    }
    let getDirectories = host.getDirectories;
    let getSourceFile = host.getSourceFile;
    let fileExists = host.fileExists;
    let readFile = host.readFile;
    let directoryExists = host.directoryExists;
    let realpath = host.realpath;
    host.fileExists = (fileName: string) => fileExists(fromVirtualFs(fileName));
    host.readFile = (fileName: string) => readFile(fromVirtualFs(fileName));
    if (directoryExists)
      host.directoryExists = (directoryName: string) => directoryExists!(fromVirtualFs(directoryName));
    if (realpath)
      host.realpath = (path: string) => toVirtualFs(realpath!(fromVirtualFs(path)));
    host.getSourceFile = (fileName: string, languageVersion: ts.ScriptTarget, onError?: (message: string) => void) => {
      let file = getSourceFile(fromVirtualFs(fileName), languageVersion, onError);
      if (file) file.fileName = toVirtualFs(file.fileName);
      return file;
    };
    host.getDirectories = (path: string) =>
      getDirectories(fromVirtualFs(path)).map(d => toVirtualFs(d));
    host.getCurrentDirectory = () => intermediatesDirectory;
    return Object.assign(host, { fromVirtualFs: fromVirtualFs, toVirtualFs: toVirtualFs, isInVirtualFs: (p) => isInVirtualFs.test(p) });
  }

  emitTsDiagnostics(reporter: Reporter, tsDiagnostics: ts.Diagnostic[], host?: CompilerHostWithVirtualFS) {
    tsDiagnostics.forEach(diagnostic => {
        if (diagnostic.file) {
          let { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
          reporter.diagnostic({
            type: mapCategory.get(diagnostic.category)!,
            col: character + 1,
            row: line + 1,
            msg: ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
            path: host ? host.fromVirtualFs(diagnostic.file.path) : diagnostic.file.path
            // , diagnostic.code ?
          });
        }
        else {
          reporter.diagnostic({
            type: mapCategory.get(diagnostic.category)!,
            msg: ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
            // , diagnostic.code ?
          });
        }
    });
  }

  isRunRequired(step: StepWithData<{ runRequired?: boolean }, {}, { sources?: string[] }>) {
    if (step.context.sharedData.sources) {
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
    let target = this.target();
    let outputDirectory = target.paths.output;
    let o = ts.convertCompilerOptionsFromJson(this.options, outputDirectory);
    this.emitTsDiagnostics(step.context.reporter, o.errors);
    if (!step.context.reporter.failed) {
      let host = this.createCompilerHost(o.options);
      let program = ts.createProgram(this.files.map(f => host.toVirtualFs(f.path)), o.options, host);
      let options = program.getCompilerOptions();
      let commonSourceDirectory: string = (program as any).getCommonSourceDirectory();
      options.mapRoot = commonSourceDirectory;
      options.sourceRoot = host.fromVirtualFs(commonSourceDirectory);
      let emitResult = program.emit();
      step.context.sharedData.sources = program.getSourceFiles().map(f => host.fromVirtualFs(f.path));
      let tsDiagnostics = ts.getPreEmitDiagnostics(program).concat(emitResult.diagnostics);
      this.emitTsDiagnostics(step.context.reporter, tsDiagnostics, host);
    }
    step.continue();
  }
}
