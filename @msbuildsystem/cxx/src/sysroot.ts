import {Reporter, File, SelfBuildGraph, TaskName, createProviderList, ProviderList} from '@msbuildsystem/core';
import {ProcessProviderConditions} from '@msbuildsystem/foundation';
import {CXXTarget, CXXFramework, CompileTask, LinkTask, CompileFileParams} from './index.priv';
import * as path from 'path';

export interface CXXSysrootDefaults {
  compilers?: { [s: string]: typeof CompileTask };
  linkers?: { [s: string]: typeof LinkTask };
  exeLinkers?: { [s: string]: typeof CompileTask };
  defaultCompiler?: string;
  defaultLinker?: string;
  defaultExeLinker?: string;
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
  isCompatible: (conditions: Conditions) => boolean;
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
  readonly linkers: { [s: string]: typeof LinkTask };
  readonly defaultCompiler: string;
  readonly defaultLinker: string;

  platform: string;
  version?: string;
  architecture?: string;

  constructor(name: TaskName, graph: CXXTarget, conditions: Conditions) {
    super(name, graph);
    this.platform = conditions.platform;
    this.version = conditions.version;
    this.architecture = conditions.architecture;
  }

  buildGraph(reporter: Reporter) {
    this.createTasks(reporter);
    return {};
  }

  createTasks(reporter: Reporter) : { compileTasks: CompileTask[], linkTasks: LinkTask[] }  {
    let compileTasks = this.createCompileTasks(reporter);
    let linkTask =  this.createLinkTask(reporter);
    linkTask.addDependencies(compileTasks);
    linkTask.addObjFiles(compileTasks.map(c => c.outputFiles[0]));
    return { compileTasks: compileTasks, linkTasks: [linkTask] };
  }

  createCompileTasks(reporter: Reporter) : CompileTask[] {
    let compileTasks = <CompileTask[]>[];
    let target = this.graph;
    target.files.forEach((params, srcFile) => {
      let relativePath = path.relative(target.project.directory, srcFile.path + ".o");
      let objFile = File.getShared(path.join(target.paths.intermediates, relativePath));
      let task = this.createCompileTask(reporter, srcFile, objFile, params);
      compileTasks.push(task);
    });
    return compileTasks;
  }

  createCompileTask(reporter: Reporter, srcFile: File, objFile: File, params: CompileFileParams) : CompileTask {
    params.compiler = params.compiler || this.graph.compiler || this.defaultCompiler;
    let compilerCstor = this.compilers[params.compiler];
    if (!compilerCstor) {
      reporter.diagnostic({ type: "error", msg: `unsupported compiler '${params.compiler}` });
      compilerCstor = CompileTask;
    }
    return new compilerCstor(this, srcFile, objFile, this.compileTaskProvider(params));
  }

  compileTaskProvider(params: CompileFileParams) : ProcessProviderConditions {
    return {compiler: params.compiler! };
  }

  createLinkTask(reporter: Reporter) : LinkTask {
    let linkerName = this.graph.linker || this.defaultLinker;
    let linkerCstor = this.linkers[linkerName];
    if (!linkerCstor) {
      reporter.diagnostic({ type: "error", msg: `unsupported compiler '${linkerName}` });
      linkerCstor = LinkTask;
    }
    return new linkerCstor(this, File.getShared(this.linkFinalPath()), this.graph.linkType, this.linkTaskProvider(linkerName));
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
