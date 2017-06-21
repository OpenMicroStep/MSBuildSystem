import {Reporter, File, SelfBuildGraph, createProviderList, ProviderList, Node} from '@openmicrostep/msbuildsystem.core';
import {ProcessProviderConditions} from '@openmicrostep/msbuildsystem.foundation';
import {CXXTarget, CXXFramework, CompileTask, LinkTask, CompilerOptions, LinkerOptions, CXXLinkType} from './index.priv';
import * as path from 'path';

export interface CXXSysrootDefaults {
  compilers: { [s: string]: typeof CompileTask };
  ranLinkers: { [s: string]: typeof LinkTask };
  exeLinkers: { [s: string]: typeof LinkTask };
  libLinkers: { [s: string]: typeof LinkTask };
  defaultCompiler: string;
  defaultRanLinker: string;
  defaultLibLinker: string;
  defaultExeLinker: string;
}
export type Conditions = {
  /** platform (ie. darwin, linux, win32, mingw-w64, mingw, bsd, ios, ...) */
  platform: string;
  version?: string;

  /** Architecture (ie. i386, x86_64, armv7, ...) */
  architecture?: string;
};
export type CXXSysrootConstructor = {
  new (graph: CXXTarget, conditions: Conditions): CXXSysroot;
  compatibility: (conditions: Conditions) => number;
};

export const CXXSysroots = Object.assign(
  createProviderList<CXXSysrootConstructor, Conditions>('sysroot'),
  {
    declare(defaults: CXXSysrootDefaults) : (constructor: CXXSysrootConstructor) => void {
      return function register(constructor: CXXSysrootConstructor) {
        CXXSysroots.register(constructor);
        Object.assign(constructor.prototype, defaults);
      };
    }
  }
);
/**
 * A sysroot is a CXX compilation toolchain kit that target a specific platform api and architecture
 */
export abstract class CXXSysroot extends SelfBuildGraph<CXXTarget> implements CXXSysrootDefaults {
  readonly compilers: { [s: string]: typeof CompileTask };
  readonly ranLinkers: { [s: string]: typeof LinkTask };
  readonly exeLinkers: { [s: string]: typeof LinkTask };
  readonly libLinkers: { [s: string]: typeof LinkTask };
  readonly defaultCompiler: string;
  readonly defaultRanLinker: string;
  readonly defaultLibLinker: string;
  readonly defaultExeLinker: string;

  platform: string;
  version?: string;
  architecture?: string;

  constructor(name: Node.Name, graph: CXXTarget, conditions: Conditions) {
    super(name, graph);
    this.platform = conditions.platform;
    this.version = conditions.version;
    this.architecture = conditions.architecture;
  }

  buildGraph(reporter: Reporter) {
    this.createTasks(reporter);
  }

  createTasks(reporter: Reporter) : { compileTasks: CompileTask[], linkTasks: LinkTask[] }  {
    let compileTasks = this.createCompileTasks(reporter);
    let linkTask =  this.createLinkTask(reporter);
    linkTask.addDependencies(compileTasks);
    linkTask.addObjFiles(compileTasks.map(c => c.outputFiles[0]));
    this.configureLinkTask(reporter, linkTask, this.graph.linkerOptions);
    return { compileTasks: compileTasks, linkTasks: [linkTask] };
  }

  createCompileTasks(reporter: Reporter) : CompileTask[] {
    let compileTasks = <CompileTask[]>[];
    let target = this.graph;
    target.files.forEach((params, srcFile) => {
      let relativePath = path.relative(target.project.directory, srcFile.path + ".o");
      let objFile = File.getShared(path.join(target.paths.intermediates, relativePath));
      let task = this.createCompileTask(reporter, srcFile, objFile, params);
      this.configureCompileTask(reporter, task, params);
      compileTasks.push(task);
    });
    return compileTasks;
  }

  createCompileTask(reporter: Reporter, srcFile: File, objFile: File, params: CompilerOptions) : CompileTask {
    params.compiler = params.compiler || this.graph.compilerOptions.compiler || this.defaultCompiler;
    let compilerCstor = this.compilers[params.compiler];
    if (!compilerCstor) {
      reporter.diagnostic({ type: "error", msg: `unsupported compiler '${params.compiler}` });
      compilerCstor = CompileTask;
    }
    return new compilerCstor(this, srcFile, objFile, this.compileTaskProvider(params));
  }

  configureCompileTask(reporter: Reporter, task: CompileTask, params: CompilerOptions) {
    task.addOptions(this.graph.compilerOptions);
  }

  compileTaskProvider(params: CompilerOptions) : ProcessProviderConditions {
    return {compiler: params.compiler! };
  }

  protected defaultLinker(type: CXXLinkType) {
    switch (type) {
      case CXXLinkType.STATIC: return this.defaultRanLinker;
      case CXXLinkType.DYNAMIC: return this.defaultLibLinker;
      case CXXLinkType.EXECUTABLE: return this.defaultExeLinker;
    }
  }
  protected linkers(type: CXXLinkType) {
    switch (type) {
      case CXXLinkType.STATIC: return this.ranLinkers;
      case CXXLinkType.DYNAMIC: return this.libLinkers;
      case CXXLinkType.EXECUTABLE: return this.exeLinkers;
    }
  }

  createLinkTask(reporter: Reporter) : LinkTask {
    let linkerName = this.graph.linkerOptions.linker || this.defaultLinker(this.graph.linkType);
    let linkerCstor = this.linkers(this.graph.linkType)[linkerName];
    if (!linkerCstor) {
      reporter.diagnostic({ type: "error", msg: `unsupported compiler '${linkerName}` });
      linkerCstor = LinkTask;
    }
    return new linkerCstor(this, File.getShared(this.linkFinalPath()), this.graph.linkType, this.linkTaskProvider(linkerName));
  }

  configureLinkTask(reporter: Reporter, task: LinkTask, params: LinkerOptions) {
    task.addOptions(this.graph.linkerOptions);
  }

  linkTaskProvider(linkerName: string) : ProcessProviderConditions {
    return {linker: linkerName};
  }

  linkFinalPath() : string {
    return path.join(this.linkBasePath(), this.graph.outputFinalName || this.linkFinalName());
  }

  linkFinalName() : string {
    return this.graph.outputName;
  }

  linkBasePath() : string {
    let ret: string;
    if (this.graph instanceof CXXFramework)
      ret = this.graph.absoluteBundleBasePath();
    else
      ret = this.graph.paths.output;
    return ret;
  }
}
