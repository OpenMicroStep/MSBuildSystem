/// <reference path="../../typings/tsd.d.ts" />
/* @flow weak */
import Sysroot = require('../core/Sysroot');
import File = require('../core/File');
import CXXTarget = require('../targets/_CXXTarget');
import CompileClangTask = require('../tasks/CompileClang');
import CompileGCCTask = require('../tasks/CompileGCC');
import LinkBinUtilsTask = require('../tasks/LinkBinUtils');
import CompileTask = require('../tasks/Compile');
import path = require('path');

class WindowsSysroot extends Sysroot {
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
    if(target.env.compiler === "clang")
      task = new CompileClangTask(srcFile, objFile);
    else
      task = new CompileGCCTask(srcFile, objFile);
    if (this.triple) {
      task.addFlags(["--target=" + this.triple]);
      task.addFlags(["--sysroot=" + this.sysrootDirectory]);
    }
    callback(null, task);
  }
  createLinkTask(target: CXXTarget, compileTasks: CompileTask[], finalFile: File, callback: Sysroot.CreateTaskCallback) {
    var task = new LinkBinUtilsTask(compileTasks, finalFile, target.linkType);
    task.bin = path.join(this.directory, this.prefix + (target.linkType === CXXTarget.LinkType.STATIC ? "ar" : "gcc"));
    if (this.triple) {
      task.addFlags(["--target=" + this.triple]);
      task.addFlags(["--sysroot=" + this.sysrootDirectory]);
    }
    callback(null, task);
  }
  linkFinalName(target: CXXTarget):string {
    var name = super.linkFinalName(target);
    switch(target.linkType) {
      case CXXTarget.LinkType.EXECUTABLE: name += ".exe"; break;
      case CXXTarget.LinkType.DYNAMIC:    name += ".dll"; break;
      case CXXTarget.LinkType.STATIC:     name += ".a"  ; break;
    }
    return name;
  }
  configure(target: CXXTarget, callback: ErrCallback) {
    target.env.linker = target.env.linker || "binutils";
    target.env.compiler = target.env.compiler || "clang";
    if(target.env.compiler !== "clang" && target.env.compiler !== "gcc")
      return callback(new Error("darwin sysroot only supports clang & gcc compilers"));
    if(target.env.linker !== "binutils")
      return callback(new Error("windows sysroot only supports binutils linker"));
    callback();
  }
}

WindowsSysroot.prototype.platform = "win32";

export = WindowsSysroot;
