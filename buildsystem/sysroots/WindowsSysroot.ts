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
import CompileMasmTask = require('../tasks/CompileMasmTask');
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
    if (path.extname(srcFile.path) === ".asm")
    {
      task= new CompileMasmTask(target, srcFile, objFile, {assembler:"msvc", arch:target.env.arch, version:this["api-version"]});
      return callback(null, task);
    }
    if(target.env.compiler === "clang") {
      task = new CompileClangTask(target, srcFile, objFile, {compiler:"clang", version:"3.7"});
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
    if (target.sysroot.api === "msvc")
      task.addFlags(["-DWIN32", "-D_USING_V110_SDK71_", "-fms-extensions", "-fms-compatibility", "-fdelayed-template-parsing", "-fmsc-version=1700", "-Wno-microsoft"/*, "-D_ITERATOR_DEBUG_LEVEL=2", "-D_DEBUG", "-D_MT"*//*, "-emit-llvm"*/]);
    if(this.cIncludes) {
      task.addFlags(["-nostdinc"]);
      // TODO: move this to provider responsability
      //if (target.sysroot.api === "msvc")
      //  task.addFlags(["-isystem", path.join(task.provider.bin, "../../lib/clang/3.7.0/include")]);
      task.addFlags(this.cIncludes);
    }

    callback(null, task);
  }
  createLinkTask(target: CXXTarget, compileTasks: CompileTask[], finalFile: File, callback: Sysroot.CreateTaskCallback) {
      var conditions: any;
    if (target.sysroot.api === "msvc") {
      if (target.linkType === CXXTarget.LinkType.STATIC)
        conditions = {archiver:"msvc", arch:target.env.arch, version:this["api-version"]};
      else
        conditions = {linker:"msvc", arch:target.env.arch, version:this["api-version"]};
      var dumpbin: Provider.Conditions = {type:"dumpbin", arch:target.env.arch, version:this["api-version"]};
      var link = new LinkMSVCTask(target, compileTasks, finalFile, target.linkType, conditions, dumpbin);
      //link.llvmLinkProvider = <Provider.Process>Provider.find({type:"llvm-link", version:"3.7"});
      //link.clangLinkProvider = <Provider.Process>Provider.find({compiler:"clang", version:"3.7"});
      //link.clangLinkArgs.push("--target=" + this.triple);
      callback(null, link);
    }
    else {
      if (target.linkType === CXXTarget.LinkType.STATIC)
        conditions = {archiver:"binutils", triple:this.triple};
      else
        conditions = {compiler:"gcc", triple:this.triple};
      var binutils = new LinkBinUtilsTask(target, compileTasks, finalFile, target.linkType, conditions);
      if (this.triple) {
        binutils.addFlags(["--target=" + this.triple]);
        binutils.addFlags(["--sysroot=" + this.sysrootDirectory]);
      }
      callback(null, binutils);
    }
  }
  linkFinalName(target: CXXTarget):string {
    var name = super.linkFinalName(target);
    switch(target.linkType) {
      case CXXTarget.LinkType.EXECUTABLE: name += ".exe"; break;
      case CXXTarget.LinkType.DYNAMIC:    name += ".dll"; break;
      case CXXTarget.LinkType.STATIC:     target.sysroot.api === "msvc" ? name += ".lib" : name += ".a" ; break;
    }
    return name;
  }
  linkFinalPath(target: CXXTarget):string {
    if(target.isInstanceOf("Bundle"))
      return super.linkFinalPath(target);
    // No rpath, soname, install_name in windows
    // The only thing that could mimic this is the "Manifest SxS" system that no one seems to understand correctly :(
    return path.join(target.outputBasePath, target.env.directories.target["Executable"], this.linkFinalName(target));
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
        task.willCopyFile(path.join(this.directory, relativePath), path.join(target.outputBasePath, target.env.directories.target["Executable"], path.basename(relativePath)));
      });
    });
    callback();
  }
}

WindowsSysroot.prototype.platform = "win32";

export = WindowsSysroot;
