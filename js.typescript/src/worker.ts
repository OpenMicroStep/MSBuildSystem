import * as ts from 'typescript';
import * as path from 'path';
import {util, Diagnostic} from '@openmicrostep/msbuildsystem.core';

let timeout = setTimeout(() => {
  console.log(`no command received`);
  process.exit(1);
}, 5000);
process.on('message', (message: InputData | "exit") => {
  clearTimeout(timeout);
  if (message === "exit")
    process.exit(0);
  else
    new TscWorker(message).do_build(out => process.send!(out));
});

export type InputData = {
  options: ts.CompilerOptions
  sourceDirectory: string
  intermediatesDirectory: string
  outputDirectory: string
  virtualPaths: string[]
  files: string[]
}
export type OutputData = {
  diagnostics: Diagnostic[]
  sources: string[]
  outputs: string[]
}
export type CompilerHostWithVirtualFS = ts.CompilerHost & {
  fromVirtualFs(p: string) : string,
  toVirtualFs(p: string) : string,
  isInVirtualFs(p: string) : boolean
};

const mapCategory = new Map<ts.DiagnosticCategory, 'warning' | 'error' | 'note'>();
mapCategory.set(ts.DiagnosticCategory.Warning, 'warning');
mapCategory.set(ts.DiagnosticCategory.Error, 'error');
mapCategory.set(ts.DiagnosticCategory.Message, 'note');

class TscWorker {
  constructor(public data: InputData) {}
  // we have to create a custom compiler host to fix out of src directory limitations
  createCompilerHost(options: ts.CompilerOptions) : CompilerHostWithVirtualFS {
    let sourceDirectory = util.pathNormalized(this.data.sourceDirectory);
    let intermediatesDirectory = util.pathNormalized(this.data.intermediatesDirectory);
    let isInVirtualFs = new RegExp(`^${util.escapeRegExp(sourceDirectory)}/(${this.data.virtualPaths.map(p => util.escapeRegExp(p)).join('|')})(?:/|$)`, 'i');
    let host = ts.createCompilerHost(options);
    function fromVirtualFs(p: string) {
      if (isInVirtualFs.test(p))
        p = path.join(intermediatesDirectory, p.substring(sourceDirectory.length + 1));
      return p;
    }
    function toVirtualFs(p: string) {
      if (p.startsWith(intermediatesDirectory))
        p = path.join(sourceDirectory, path.relative(intermediatesDirectory, p));
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
    host.getCurrentDirectory = () => sourceDirectory;
    return Object.assign(host, { fromVirtualFs: fromVirtualFs, toVirtualFs: toVirtualFs, isInVirtualFs: (p) => isInVirtualFs.test(p) });
  }

  emitTsDiagnostics(diagnostics: Diagnostic[], tsDiagnostics: ts.Diagnostic[], host?: CompilerHostWithVirtualFS) : boolean {
    let success = true;
    tsDiagnostics.forEach(diagnostic => {
        if (diagnostic.category === ts.DiagnosticCategory.Error)
          success = false;
        if (diagnostic.file && typeof diagnostic.start === "number") {
          let { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
          let filename = util.pathNormalized(diagnostic.file.fileName);
          diagnostics.push({
            is: mapCategory.get(diagnostic.category)!,
            col: character + 1,
            row: line + 1,
            msg: ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
            path: host ? host.fromVirtualFs(filename) : filename
            // , diagnostic.code ?
          });
        }
        else {
          diagnostics.push({
            is: mapCategory.get(diagnostic.category)!,
            msg: ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
            // , diagnostic.code ?
          });
        }
    });
    return success;
  }

  do_build(cb: (out: OutputData) => void) {
    let out: OutputData = {
      diagnostics: [],
      sources: [],
      outputs: [],
    };
    let outputDirectory = this.data.outputDirectory;
    let o = ts.convertCompilerOptionsFromJson(this.data.options, outputDirectory);
    if (this.emitTsDiagnostics(out.diagnostics, o.errors)) {
      o.options.listEmittedFiles = true;
      let host = this.createCompilerHost(o.options);
      let program = ts.createProgram(this.data.files.map(f => host.toVirtualFs(f)), o.options, host);
      let emitResult = program.emit();
      out.sources = program.getSourceFiles().map(f => host.fromVirtualFs(util.pathNormalized(f.fileName)));
      out.outputs = emitResult.emittedFiles.map(f => util.pathNormalized(f));
      let tsDiagnostics = [...ts.getPreEmitDiagnostics(program), ...emitResult.diagnostics];
      this.emitTsDiagnostics(out.diagnostics, tsDiagnostics, host);
    }
    cb(out);
  }
}
