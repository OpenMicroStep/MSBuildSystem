import {
  Reporter, SelfBuildGraph, File, Task,
  createBuildGraphProviderList, BuildGraphProviderList,
} from '@openmicrostep/msbuildsystem.core';
import {
  CXXTarget, CXXLibrary, CXXFramework, CXXApplicationBundle, CXXBundle, CXXLinkType,
  CompileTask, CompileAttributes, CompilerOptions,
  LinkTask, LinkerOptions,
} from '../index.priv';
import * as path from 'path';

export abstract class Toolchain extends SelfBuildGraph<CXXTarget> {
  buildGraph(reporter: Reporter) {
    let { tasks, objFiles } = this.createLinkObjFilesTasks(reporter);
    let linkTask = this.createLinkTask(reporter, objFiles);
    linkTask.addDependencies(tasks);
  }

  createLinkObjFilesTasks(reporter: Reporter) : { tasks: Task[], objFiles: Set<File> } {
    let compileTasks = this.createCompileTasks(reporter);
    let objFiles = new Set(compileTasks.map(c => c.attributes.objFile));
    return { tasks: compileTasks, objFiles: objFiles };
  }

  createCompileTasks(reporter: Reporter) : CompileTask[] {
    let compileTasks: CompileTask[] = [];
    for (let group of this.graph.files) {
      for (let srcFile of group.elements) {
        compileTasks.push(this.createCompileTask(reporter, srcFile, group));
      }
    }
    return compileTasks;
  }

  createCompileTask(reporter: Reporter, srcFile: File, options: CompilerOptions) : CompileTask {
    let target = this.graph;
    let relativePath = path.relative(target.project.directory, srcFile.path);
    let dstPath = path.join(target.paths.intermediates, relativePath);
    let objFile = File.getShared(`${dstPath}.o`);
    let hmapFile = File.getShared(`${dstPath}.hmap`);
    let o = CompilerOptions.empty();
    CompilerOptions.merge(o, options);
    CompilerOptions.merge(o, target.compilerOptions);
    this.mutateCompilerOptions(o);
    let a: CompileAttributes = {
      srcFile: srcFile,
      objFile: objFile,
      hmapFile: hmapFile,
      compilerOptions: o,
    };
    return new CompileTask(srcFile.name, this, a);
  }

  createLinkTask(reporter: Reporter, objFiles: Set<File>) : LinkTask {
    let target = this.graph;
    let outFile = File.getShared(this.linkFinalPath());
    let o = LinkerOptions.empty();
    LinkerOptions.merge(o, target.linkerOptions);
    this.mutateLinkerOptions(o);
    let l = new LinkTask(outFile.name, this, {
      objFiles: objFiles,
      outFile: outFile,
      linkerOptions: o,
    });
    return l;
  }

  abstract mutateCompilerOptions(options: CompilerOptions): void;
  abstract mutateLinkerOptions(options: LinkerOptions): void;
  abstract linkFinalName(name: string) : string;

  bundleBasePath() {
    if (this.graph instanceof CXXBundle)
      return `bundle`;
    if (this.graph instanceof CXXApplicationBundle)
      return `app`;
    return `framework`;
  }

  linkExportName() : string {
    return `-l${this.graph.outputFinalName || this.graph.outputName}`;
  }

  linkFinalPath() : string {
    return this.graph.outputFinalName
      ? path.join(this.graph.paths.output, this.graph.outputFinalName)
      : path.join(this.linkBasePath(), this.linkFinalName(this.graph.outputName));
  }

  linkBasePath() : string {
    let ret: string;
    if (this.graph instanceof CXXFramework)
      ret = this.graph.absoluteBundleBasePath();
    else if (this.graph instanceof CXXLibrary)
      ret = this.linkBaseLibPath();
    else
      ret = this.linkBaseBinPath();
    return ret;
  }

  linkBaseBinPath() {
    return path.join(this.graph.paths.output, "bin");
  }

  linkBaseLibPath() {
    return path.join(this.graph.paths.output, "lib");
  }
}

class NotFoundToolchain extends Toolchain {
  constructor(graph: CXXTarget) {
    super({ type: "toolchain", name: "notfound" }, graph);
  }

  mutateCompilerOptions(options: CompilerOptions): void {
  }
  mutateLinkerOptions(options: LinkerOptions): void {
  }
  linkFinalName(name: string): string {
    return this.graph.outputName;
  }
}

export const Toolchains: BuildGraphProviderList<CXXTarget, Toolchain> = createBuildGraphProviderList('cxx toolchains', NotFoundToolchain);

