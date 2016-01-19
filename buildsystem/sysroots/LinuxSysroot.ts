import Sysroot = require('../core/Sysroot');
import File = require('../core/File');
import Provider = require('../core/Provider');
import Target = require('../core/Target');
import CXXTarget = require('../targets/_CXXTarget');
import CompileClangTask = require('../tasks/CompileClang');
import CompileGCCTask = require('../tasks/CompileGCC');
import LinkBinUtilsTask = require('../tasks/LinkBinUtils');
import CompileTask = require('../tasks/Compile');
import path = require('path');
import _ = require('underscore');

class LinuxSysroot extends Sysroot {
  triple:string;
  prefix:string;
  sysrootDirectory:string;
  constructor(directory:string, extension:{}) {
    super(directory, extension);
    this.sysrootDirectory = this.sysrootDirectory || this.directory;
    this.prefix = this.prefix || ("bin/" + (this.triple || ""));
  }
  createCompileTask(target: CXXTarget, srcFile: File, objFile: File, callback: Sysroot.CreateTaskCallback) {
    var task;
    if(target.env.compiler === "clang") {
      task = new CompileClangTask(target, srcFile, objFile);
    }
    else {
      task = new CompileGCCTask(target, srcFile, objFile, {compiler:"gcc", triple:this.triple});
    }
    if(target.linkType !== CXXTarget.LinkType.EXECUTABLE)
      task.addFlags(["-fPIC"]);
    if (this.triple) {
      task.addFlags(["--target=" + this.triple]);
      task.addFlags(["--sysroot=" + this.sysrootDirectory]);
    }
    callback(null, task);
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
  linkFinalName(target: CXXTarget):string {
    var name = super.linkFinalName(target);
    if(target.isInstanceOf("Library"))
      name = "lib" + name + (target.linkType === CXXTarget.LinkType.DYNAMIC ? ".so" : ".a");
    return name;
  }
  configure(target: CXXTarget, callback: ErrCallback) {
    target.env.linker = target.env.linker || "binutils";
    target.env.compiler = target.env.compiler || "clang";
    if(target.env.compiler !== "clang" && target.env.compiler !== "gcc")
      return callback(new Error("linux sysroot only supports clang & gcc compilers"));
    if(target.env.linker !== "binutils")
      return callback(new Error("linux sysroot only supports binutils linker"));
    callback();
  }
}

LinuxSysroot.prototype.platform = "win32";

export = LinuxSysroot;
