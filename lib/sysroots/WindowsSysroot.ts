/// <reference path="../../typings/tsd.d.ts" />
/* @flow weak */
'use strict';

import Graph = require('../core/Graph');
import Sysroot = require('../core/Sysroot');
import File = require('../core/File');
import Provider = require('../core/Provider');
import CXXTarget = require('../targets/_CXXTarget');
import CompileClangTask = require('../tasks/CompileClang');
import CompileGCCTask = require('../tasks/CompileGCC');
import LinkBinUtilsTask = require('../tasks/LinkBinUtils');
import LinkMSVCTask = require('../tasks/LinkMSVC');
import CompileTask = require('../tasks/Compile');
import CopyTask = require('../tasks/Copy');
import path = require('path');

class WindowsSysroot extends Sysroot {
  triple:string;
  prefix:string;
  sysrootDirectory:string;
  cIncludes: string[];
  cppIncludes: string[];
  installLibraries: string[];
  libraries: string[];

  constructor(directory:string, extension:{}) {
    super(directory, extension);
    this.sysrootDirectory = this.sysrootDirectory || this.directory;
    this.prefix = this.prefix || ("bin/" + (this.triple || ""));
    if(this.cIncludes)
      this.cIncludes = this.mapIncludes(this.cIncludes);
    if(this.cppIncludes)
      this.cppIncludes = this.mapIncludes(this.cppIncludes);
    this.installLibraries = this.installLibraries || [];
  }
  mapIncludes(includes: string[]): string[] {
    var out = [];
    includes.forEach((inc) => {
      out.push("-isystem", path.join(this.sysrootDirectory, inc));
    });
    return out;
  }

  createCompileTask(target: CXXTarget, srcFile: File, objFile: File, callback: Sysroot.CreateTaskCallback) {
    var task;
    if(target.env.compiler === "clang") {
      task = new CompileClangTask(target, srcFile, objFile);
      task.provider = <Provider.Process>Provider.find({compiler:"clang", version:"3.7"});
      //if (target.sysroot.api === "msvc")
      //  task.bin = "C:/Program Files (x86)/LLVM/bin/clang.exe";
      if(target.linkType !== CXXTarget.LinkType.STATIC)
        task.addFlags(["-fPIC"]);
    }
    else {
      task = new CompileGCCTask(target, srcFile, objFile);
    }
    if (this.triple)
      task.addFlags(["--target=" + this.triple]);
    task.addFlags(["--sysroot=" + this.sysrootDirectory]);
    if((task.language === "CXX" || task.language === "OBJCXX") && this.cppIncludes) {
      task.addFlags(["-nostdinc++"]);
      task.addFlags(this.cppIncludes);
    }
    if (target.sysroot.api === "msvc") {
      task.addFlags(["-fms-extensions", "-fms-compatibility", "-fdelayed-template-parsing", "-fno-rtti", "-fmsc-version=1800"]);}
    if(this.cIncludes) {
      task.addFlags(["-nostdinc"]);
      if (target.sysroot.api === "msvc")
        task.addFlags(["-isystem", path.join(task.provider.bin, "../../lib/clang/3.7.0/include")]);
      task.addFlags(this.cIncludes);
    }
    if(target.variant === "release")
      task.addFlags(["-O3"]);

    callback(null, task);
  }
  createLinkTask(target: CXXTarget, compileTasks: CompileTask[], finalFile: File, callback: Sysroot.CreateTaskCallback) {
    if (target.env.linker === "msvc") {
      var task = new LinkMSVCTask(target, compileTasks, finalFile, target.linkType);
      var conditions: any = {linker:"msvc", arch:target.env.arch, version:this["api-version"]};
      task.provider = <Provider.Process>Provider.find(conditions);
      if (this.libraries) {
        this.libraries.forEach((lib) => {
          task.addFlags(["/libpath:"+path.join(this.sysrootDirectory, lib)]);
        });
      }
    }
    else {
      var task = new LinkBinUtilsTask(target, compileTasks, finalFile, target.linkType);
      if (target.linkType === CXXTarget.LinkType.STATIC)
        task.provider = <Provider.Process>Provider.find({archiver:"binutils", triple:this.triple});
      else
        task.provider = <Provider.Process>Provider.find({compiler:"gcc", triple:this.triple});
      if (this.triple) {
        task.addFlags(["--target=" + this.triple]);
        task.addFlags(["--sysroot=" + this.sysrootDirectory]);
      }
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
  linkFinalPath(target: CXXTarget):string {
    if(target.isInstanceOf("Bundle"))
      return super.linkFinalPath(target);
    // No rpath, soname, install_name in windows
    // The only thing that could mimic this is the "Manifest SxS" system that no one seems to understand correctly :(
    return path.join(target.graph.output, target.env.directories.target["Executable"], this.linkFinalName(target));
  }
  configure(target: CXXTarget, callback: ErrCallback) {
    target.env.linker = target.env.linker || "binutils";
    target.env.compiler = target.env.compiler || "clang";
    if(target.env.compiler !== "clang" && target.env.compiler !== "gcc")
      return callback(new Error("darwin sysroot only supports clang & gcc compilers"));
    if(target.env.linker !== "binutils" && target.env.linker !== "msvc")
      return callback(new Error("windows sysroot only supports binutils & msvc linker"));
    target.addTaskModifier('Copy', (target, task: CopyTask) => {
      this.installLibraries.forEach((relativePath) => {
        task.willCopyFile(path.join(this.directory, relativePath), path.join(target.graph.output, target.env.directories.target["Executable"], path.basename(relativePath)));
      });
    });
    callback();
  }
}

WindowsSysroot.prototype.platform = "win32";

export = WindowsSysroot;
