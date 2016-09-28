import {Reporter, File, ProviderConditions} from '@msbuildsystem/core';
import {CXXTarget, CXXFramework, CompileTask, LinkTask, CompileFileParams} from './index.priv';
import * as path from 'path';

export interface CXXSysrootDefaults {
  compilers: { [s: string]: typeof CompileTask };
  linkers: { [s: string]: typeof LinkTask };
  defaultCompiler: string;
  defaultLinker: string;
}
export type Conditions = {
  /** platform (ie. darwin, linux, win32, mingw-w64, mingw, bsd, ios, ...) */
  platform: string;
  version?: string;

  /** Architecture (ie. i386, x86_64, armv7, ...) */
  architecture?: string;
};
export type CXXSysrootConstructor = { new (conditions: Conditions): CXXSysroot, isCompatible: (conditions: Conditions) => boolean };

export var sysrootClasses = <CXXSysrootConstructor[]>[];
export function declareSysroot(defaults: CXXSysrootDefaults) {
  return function (constructor: CXXSysrootConstructor) {
    sysrootClasses.push(constructor);
    constructor.prototype.compilers = defaults.compilers;
    constructor.prototype.linkers = defaults.linkers;
    constructor.prototype.defaultCompiler = defaults.defaultCompiler;
    constructor.prototype.defaultLinker = defaults.defaultLinker;
  };
}

/**
 * A sysroot is a CXX compilation toolchain kit that target a specific platform api and architecture
 */
export abstract class CXXSysroot implements CXXSysrootDefaults {
  readonly compilers: { [s: string]: typeof CompileTask };
  readonly linkers: { [s: string]: typeof LinkTask };
  readonly defaultCompiler: string;
  readonly defaultLinker: string;

  platform: string;
  version?: string;
  architecture?: string;

  target: CXXTarget;
  constructor(conditions: Conditions) {
    this.platform = conditions.platform;
    this.version = conditions.version;
    this.architecture = conditions.architecture;
  }

  static find(conditions: Conditions) : CXXSysrootConstructor[] {
    return sysrootClasses.filter(s => s.isCompatible(conditions));
  }

  buildGraph(reporter: Reporter) : { compileTasks: CompileTask[], linkTasks: LinkTask[] } {
    let compileTasks = this.createCompileTasks(reporter);
    let linkTask =  this.createLinkTask(reporter);
    linkTask.addDependencies(compileTasks);
    linkTask.addObjFiles(compileTasks.map(c => c.outputFiles[0]));
    return { compileTasks: compileTasks, linkTasks: [linkTask] };
  }

  createCompileTask(reporter: Reporter, srcFile: File, objFile: File, params: CompileFileParams) : CompileTask {
    params.compiler = params.compiler || this.target.compiler || this.defaultCompiler;
    let compilerCstor = this.compilers[params.compiler];
    if (!compilerCstor) {
      reporter.diagnostic({ type: "error", msg: `unsupported compiler '${params.compiler}` });
      compilerCstor = CompileTask;
    }
    return new compilerCstor(this.target, srcFile, objFile, this.compileTaskProvider(params));
  }

  compileTaskProvider(params: CompileFileParams) : ProviderConditions {
    return {compiler: params.compiler! };
  }

  createLinkTask(reporter: Reporter) : LinkTask {
    let linkerName = this.target.linker || this.defaultLinker;
    let linkerCstor = this.linkers[linkerName];
    if (!linkerCstor) {
      reporter.diagnostic({ type: "error", msg: `unsupported compiler '${linkerName}` });
      linkerCstor = LinkTask;
    }
    return new linkerCstor(this.target, File.getShared(this.linkFinalPath()), this.target.linkType, this.linkTaskProvider(linkerName));
  }

  linkTaskProvider(linkerName: string) : ProviderConditions {
    return {linker: linkerName};
  }

  createCompileTasks(reporter: Reporter) : CompileTask[] {
    let compileTasks = <CompileTask[]>[];
    let target = this.target;
    target.files.forEach((params, srcFile) => {
      let relativePath = path.relative(target.project.directory, srcFile.path + ".o");
      let objFile = File.getShared(path.join(target.paths.intermediates, relativePath));
      let task = this.createCompileTask(reporter, srcFile, objFile, params);
      compileTasks.push(task);
    });
    return compileTasks;
  }

  linkFinalPath() : string {
    return path.join(this.linkBasePath(), this.target.outputFinalName || this.linkFinalName());
  }

  linkFinalName() : string {
    return this.target.outputName;
  }

  linkBasePath() : string {
    let ret: string;
    if (this.target instanceof CXXFramework)
      ret = this.target.absoluteBundleBasePath();
    else
      ret = this.target.paths.output;
    return ret;
  }
}
