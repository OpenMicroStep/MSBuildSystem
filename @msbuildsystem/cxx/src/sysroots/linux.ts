import {Reporter, SubGraph, File, Graph} from '@openmicrostep/msbuildsystem.core';
import {ProcessTask} from '@openmicrostep/msbuildsystem.foundation';
import {CompileFileParams, CXXLinkType} from '../target';
import {CXXSysroot, Conditions} from '../sysroot';
import {CompileTask} from '../tasks/compile';
import {LinkTask} from '../tasks/link';
import {LinkBinUtilsTask} from '../tasks/linkBinUtils';
import {CompileClangTask} from '../tasks/compileClang';
import {CompileGCCTask} from '../tasks/compileGCC';
import {CXXLibrary} from '../targets/library';
import {CXXFramework} from '../targets/framework';

@declareSysroot({
  compilers: {
    "clang": CompileClangTask,
    "gcc": CompileGCCTask
  },
  linkers: {
    "binutils": LinkBinUtilsTask
  },
  defaultCompiler: "clang",
  defaultLinker: "clang"
})
class LinuxSysroot extends CXXSysroot {

  createCompileTask(reporter: Reporter, graph: Graph, srcFile: File, objFile: File, params: CompileFileParams) : CompileTask {
    let task = super.createCompileTask(reporter, graph, srcFile, objFile, params);
    if (this.target.linkType !== CXXLinkType.EXECUTABLE)
      task.addFlags(["-fPIC"]);
    // if (this.triples && target.linkType !== CXXTarget.LinkType.STATIC)
    //   task.addFlags(["--target=" + this.triples[target.arch]]);
    //   task.addFlags(["--sysroot=" + this.sysrootDirectory]);
    return task;
  }

  createLinkTask(reporter: Reporter, graph: Graph) : LinkTask {
    let task = super.createLinkTask(reporter, graph);
    this._addFlags(task);
    return task;
  }

  linkTaskProvider(linkerName: string) {
    let provider;
    if (target.linkType === CXXTarget.LinkType.STATIC)
      conditions = {archiver:"binutils", triple:this.triple};
    else
      conditions = {compiler:"gcc", triple:this.triple};
  }

  createLinkTask(target: CXXTarget, compileTasks: CompileTask[], finalFile: File, callback: Sysroot.CreateTaskCallback) {
    var conditions;
    if (target.linkType === CXXTarget.LinkType.STATIC)
      conditions = {archiver:"binutils", triple:this.triple};
    else
      conditions = {compiler:"gcc", triple:this.triple};

    var task = new LinkBinUtilsTask(target, compileTasks, finalFile, target.linkType, conditions);
    if (target.linkType !== CXXTarget.LinkType.STATIC)
      task.addFlags(["-Wl,-soname," + this.linkFinalName(target)]);
    var basepath= path.dirname(finalFile.path);
    var rpaths = [];
    var rpathslnk = [];
    var exported = new Set<Target>();
    var deep = (parent: Target) => {
      parent.dependencies.forEach((dep) => {
        if (!exported.has(dep)) {
          exported.add(dep);
          rpaths.push(path.relative(basepath, path.dirname(this.linkFinalPath(<CXXTarget>dep))));
          rpathslnk.push(path.dirname(this.linkFinalPath(<CXXTarget>dep)));
          deep(dep);
        }
      });
    };
    deep(target);
    rpathslnk= _.unique(rpathslnk);
    rpaths= _.unique(rpaths);
    task.addFlags(rpaths.map((p) => { return "-Wl,-rpath,$ORIGIN/" + p + "/"; }));
    task.addFlags(rpathslnk.map((p) => { return "-Wl,-rpath-link," + p; }));
    task.addFlags(["-Wl,-rpath-link," + path.join(this.sysrootDirectory, 'usr/lib/x86_64-linux-gnu')]);
    task.addFlags(["-Wl,-rpath-link," + path.join(this.sysrootDirectory, 'lib/x86_64-linux-gnu')]);
    if (this.triple) {
      task.addFlags(["--target=" + this.triple]);
      task.addFlags(["--sysroot=" + this.sysrootDirectory]);
    }
    callback(null, task);
  }

  linkFinalName() : string {
    let name = super.linkFinalName();
    if (this.target instanceof CXXLibrary)
        name = "lib" + name +(this.target.linkType === CXXLinkType.DYNAMIC ? ".so" : ".a");
    return name;
  }
}

LinuxSysroot.prototype.platform = "win32";

export = LinuxSysroot;
