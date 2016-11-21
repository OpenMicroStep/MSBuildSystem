import { declareTask, Task, Reporter, SelfBuildGraph, File, Step, resolver, AttributeTypes, util } from '@msbuildsystem/core';
import { JSTarget, JSCompilers } from '@msbuildsystem/js';
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

  buildGraph(reporter: Reporter) {
    super.buildGraph(reporter);
    let tsc = new TypescriptTask({ type: "typescript", name: "tsc" }, this);
    tsc.addFiles(this.graph.files);
    tsc.setOptions(this.tsConfig);
    tsc.setOptions({
      outDir: this.graph.packager.absoluteCompilationOutputDirectory()
    });
  }
}

function emitTsDiagnostics(reporter: Reporter, tsDiagnostics: ts.Diagnostic[]) {
  tsDiagnostics.forEach(diagnostic => {
      if (diagnostic.file) {
        let { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
        reporter.diagnostic({
          type: mapCategory.get(diagnostic.category)!,
          col: character + 1,
          row: line + 1,
          msg: ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
          path: diagnostic.file.path
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

@declareTask({ type: "typescript" })
export class TypescriptTask extends Task {
  files: File[] = [];
  options: ts.CompilerOptions = {};

  setOptions(options: ts.CompilerOptions) {
    this.options = Object.assign(this.options, options);
  }

  addFiles(files: File[]) {
    this.files.push(...files);
  }

  // TODO: incremental build
  // TODO: clean output
  // TODO: async run (slower startup with tsc or create and use a worker API)

  run(step: Step<{}>) {
    let projectDirectory = this.target().project.directory;
    let outputDirectory = this.target().paths.output;
    let workaroundContainingFile = path.join(outputDirectory, 'workaround.ts');
    let o = ts.convertCompilerOptionsFromJson(this.options, outputDirectory);
    emitTsDiagnostics(step.context.reporter, o.errors);
    if (!step.context.reporter.failed) {
      let host = ts.createCompilerHost(o.options);
      host.getCurrentDirectory = () => outputDirectory;
      let loader = function (moduleName, containingFile) {
        if (moduleName[0] !== '.' && moduleName[0] !== '/' && !containingFile.startsWith(outputDirectory))
          containingFile = workaroundContainingFile;
        return ts.resolveModuleName(moduleName, containingFile, o.options, host).resolvedModule;
      };
      host.resolveModuleNames = function resolveModuleNames(moduleNames: string[], containingFile: string) : ts.ResolvedModule[] {
        return loadWithLocalCache(moduleNames, containingFile, loader);
      };
      let program = ts.createProgram(this.files.map(f => f.path), o.options, host);
      let emitResult = program.emit();
      let tsDiagnostics = ts.getPreEmitDiagnostics(program).concat(emitResult.diagnostics);
      emitTsDiagnostics(step.context.reporter, tsDiagnostics);
    }
    step.continue();
  }

  requiredDo(step: Step<{}>) {
    if (step.context.runner.action !== "generate")
      return super.requiredDo(step);

    let ide: string = step.context.runner.options['ide'];
    if (ide !== 'terminal')
      return step.continue();

    let dir = File.commonDirectoryPath(this.files);
    let tsconfig = File.getShared(path.join(dir, 'tsconfig.json'));
    tsconfig.ensureDir((err) => {
      if (err) {
        step.context.reporter.error(err, { type: "error", path: tsconfig.path, msg: "unable to create directory for writing file" });
        step.continue();
      }
      else {
        tsconfig.writeUtf8File(JSON.stringify({
           compilerOptions: this.options,
           files: this.files.map(f => f.relativePath(dir))
        }, null, 2), (err) => {
          if (err) step.context.reporter.error(err, { type: "error", path: tsconfig.path, msg: "unable to write file" });
          step.continue();
        });
      }
    });
  }
}

function loadWithLocalCache(names: string[], containingFile: string, loader: (moduleName: string, containingFile: string) => ts.ResolvedModule) : ts.ResolvedModule[] {
    if (names.length === 0)
        return [];
    var resolutions = <ts.ResolvedModule[]>[];
    var cache = new Map<string, ts.ResolvedModule>();
    for (var name of names) {
      let result: ts.ResolvedModule;
      if (cache.has(name))
        result = cache.get(name)!;
      else
        cache.set(name, result = loader(name, containingFile));
      resolutions.push(result);
    }
    return resolutions;
}
