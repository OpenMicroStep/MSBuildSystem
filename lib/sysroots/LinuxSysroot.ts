/// <reference path="../../typings/tsd.d.ts" />
/* @flow weak */
'use strict';

import Sysroot = require('../core/Sysroot');
import File = require('../core/File');
import Provider = require('../core/Provider');
import CXXTarget = require('../targets/_CXXTarget');
import CompileClangTask = require('../tasks/CompileClang');
import CompileGCCTask = require('../tasks/CompileGCC');
import LinkBinUtilsTask = require('../tasks/LinkBinUtils');
import CompileTask = require('../tasks/Compile');
import path = require('path');

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
      task.provider= <Provider.Process>Provider.find({compiler:"clang"});
    }
    else {
      task = new CompileGCCTask(target, srcFile, objFile);
      task.provider= <Provider.Process>Provider.find({compiler:"gcc", triple:this.triple});
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
    var task = new LinkBinUtilsTask(target, compileTasks, finalFile, target.linkType);
    if (target.linkType === CXXTarget.LinkType.STATIC)
      task.provider = <Provider.Process>Provider.find({archiver:"binutils", triple:this.triple});
    else
      task.provider = <Provider.Process>Provider.find({compiler:"gcc", triple:this.triple});
    if (this.triple) {
      task.addFlags(["--target=" + this.triple]);
      task.addFlags(["--sysroot=" + this.sysrootDirectory]);
    }
    callback(null, task);
  }
  linkFinalName(target: CXXTarget):string {
    var name = super.linkFinalName(target);
    if(target.isInstanceOf("Library") && !target.isInstanceOf("Bundle") && !target.isInstanceOf("Framework"))
      name += (target.linkType === CXXTarget.LinkType.DYNAMIC ? ".so" : ".a");
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
