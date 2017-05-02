import {Reporter, File, AttributeTypes, Target} from '@openmicrostep/msbuildsystem.core';
import {ProcessTask} from '@openmicrostep/msbuildsystem.foundation';
import {
  CompilerOptions, LinkerOptions, Conditions, CXXSysroots, CXXTarget,
  CXXSysroot, CXXLibrary, CXXFramework, CXXLinkType,
  CompileTask, LinkTask, LinkClangTask, LinkLibToolTask, LipoTask, CompileClangTask, CompileGCCTask
} from '../index.priv';

@CXXSysroots.declare({
  compilers: {
    "clang": CompileClangTask,
    "gcc": CompileGCCTask
  },
  ranLinkers: { "libtool": LinkLibToolTask },
  libLinkers: { "clang": LinkClangTask },
  exeLinkers: { "clang": LinkClangTask },
  defaultCompiler: "clang",
  defaultRanLinker: "libtool",
  defaultLibLinker: "clang",
  defaultExeLinker: "clang",
})
export class CXXDarwinSysroot extends CXXSysroot {
  architectures: string[];

  osxVersionMin = "10.10";

  constructor(graph: CXXTarget, conditions: Conditions) {
    super({ type: 'sysroot', name: 'darwin' }, graph, conditions);
    this.architectures = (this.architecture || "").split(",");
  }

  static isCompatible(conditions: Conditions) : boolean {
    return conditions.platform === "darwin";
  }

  createTasks(reporter: Reporter) {
    if (this.architectures.length <= 1)
      return super.createTasks(reporter);

    let ret = { compileTasks: <CompileTask[]>[], linkTasks: <LinkTask[]>[] };
    for (let arch of this.architectures) {
      this.architecture = arch;
      let sub = super.createTasks(reporter);
      ret.compileTasks.push(...sub.compileTasks);
      ret.linkTasks.push(...sub.linkTasks);
    }
    this.architecture = "";
    let lipoTask = new LipoTask(this.graph, ret.linkTasks, File.getShared(this.linkFinalPath()));
    ret.linkTasks = [lipoTask];
    return ret;
  }

  configureCompileTask(reporter: Reporter, task: CompileTask, params: CompilerOptions) {
    this._addFlags(task);
    super.configureCompileTask(reporter, task, params);
  }

  configureLinkTask(reporter: Reporter, task: LinkTask, params: LinkerOptions) {
    this._addFlags(task);
    super.configureLinkTask(reporter, task, params);
  }

  _addFlags(task: ProcessTask) {
    if (task instanceof LinkLibToolTask) {
      if (this.graph.linkType !== CXXLinkType.STATIC)
        task.addFlags([`-compatibility_version`, this.osxVersionMin]);
    }
    else
      task.addFlags([`-mmacosx-version-min=${this.osxVersionMin}`]);
    if (this.graph.linkType === CXXLinkType.DYNAMIC)
      task.addFlags(["-fPIC"]);
    // if (this.triples && target.linkType !== CXXTarget.LinkType.STATIC)
    //   task.addFlags(["--target=" + this.triples[target.arch]]);
  }

  linkFinalName() : string {
    let name = super.linkFinalName();
    if (this.graph instanceof CXXLibrary && !(this.graph instanceof CXXFramework)) {
        name = "lib" + name;
        name += (this.architectures.length > 1 && this.architecture ? "." + this.architecture : "");
        name += (this.graph.linkType === CXXLinkType.DYNAMIC ? ".dylib" : ".a");
    }
    return name;
  }
}
