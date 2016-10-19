import { declareTask, Task, Reporter, SelfBuildGraph, File, Step } from '@msbuildsystem/core';
import { JSTarget, JSCompilers } from '@msbuildsystem/js';
import * as ts from 'typescript';

const mapCategory = new Map<ts.DiagnosticCategory, 'warning' | 'error' | 'note'>();
mapCategory.set(ts.DiagnosticCategory.Warning, 'warning');
mapCategory.set(ts.DiagnosticCategory.Error, 'error');
mapCategory.set(ts.DiagnosticCategory.Message, 'note');



@JSCompilers.declare(['typescript', 'ts'])
export class TypescriptJSCompiler extends SelfBuildGraph<JSTarget> {
  constructor(graph: JSTarget) {
    super({ type: "compiler", name: "typescript" }, graph);
  }

  buildGraph(reporter: Reporter) {
    let tsc = new TypescriptTask({ type: "typescript", name: "tsc" }, this);
    tsc.addFiles(this.graph.files);
  }
}

@declareTask({ type: "typescript" })
export class TypescriptTask extends Task {
  files: File[] = [];
  options: ts.CompilerOptions = {};

  setOptions(options: ts.CompilerOptions) {
    this.options = Object.assign(this.options, options);
  }

  addFiles(files: File[]) {
    files.push(...files);
  }

  // TODO: incremental build
  // TODO: clean output
  // TODO: async run (slower startup with tsc or create and use a worker API)

  run(step: Step) {
    let program = ts.createProgram(this.files.map(f => f.path), this.options);
    let emitResult = program.emit();
    let tsDiagnostics = ts.getPreEmitDiagnostics(program).concat(emitResult.diagnostics);
    tsDiagnostics.forEach(diagnostic => {
        let { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
        step.diagnostic({
          type: mapCategory.get(diagnostic.category)!,
          col: character + 1,
          row: line + 1,
          msg: ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
          path: diagnostic.file.path
          // , diagnostic.code ?
        });
    });
    step.continue();
  }
}
