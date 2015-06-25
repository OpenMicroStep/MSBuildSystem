/// <reference path="../../typings/tsd.d.ts" />
/* @flow weak */
'use strict';

import CompileTask = require('./Compile');
import File = require('../core/File');
import Task = require('../core/Task');
import LinkTask = require('./Link');
import Graph = require('../core/Graph');
import CXXTarget = require('../targets/_CXXTarget');
import path = require('path');

class LinkMSVCTask extends LinkTask {
  constructor(graph: Graph, compileTasks: CompileTask[], finalFile: File, type: CXXTarget.LinkType) {
    super(graph, compileTasks, finalFile, type);
    //this.bin = "/Users/vincentrouille/Dev/MicroStep/llvm/build-release/bin/lld";
    //this.setEnv({
    //  PATH:"/Users/vincentrouille/Dev/MicroStep/MSXcodePlugin/MSBuildSystem/sysroots/i686-msvc12/tools;" + process.env.PATH
    //});
    //this.appendArgs(["-flavor", "link"]);
    //this.appendArgs(["/Users/vincentrouille/Dev/MicroStep/MSXcodePlugin/MSBuildSystem/sysroots/i686-msvc12/tools/link.exe"]);
    //this.bin= "C:/Program Files (x86)/Microsoft Visual Studio 11.0/VC/bin/link.exe";
    this.setEnv({
      PATH: "C:/Program Files (x86)/Microsoft Visual Studio 11.0/VC/BIN;"
        + "C:/Program Files (x86)/Microsoft Visual Studio 11.0/Common7/IDE;"
        + process.env.PATH
    });
    if(this.type === CXXTarget.LinkType.STATIC) {
      throw "not supported";
    }
    else {
      this.appendArgs(["kernel32.lib", "user32.lib", "shell32.lib", "libcmt.lib"]);
      this.appendArgs(["/debug"]);
      if(this.type === CXXTarget.LinkType.DYNAMIC)
        this.appendArgs(["/dll"]);
      this.appendArgs(["/out:" + finalFile.path]);
    }
    this.appendArgs(this.inputFiles.map(function (file) {
      return /*"Z:" + */file.path;
    }));
  }
  addFlags(libs: string[]) {
    this.insertArgs(2, libs);
  }

  addLibraryFlags(libs: string[]) {
    if(this.type !== CXXTarget.LinkType.STATIC)
      this.addFlags(libs.map(function(lib) {
        if (lib[0] == '-' && lib[1] == 'l')
          lib= lib.substring(2) + ".lib";
        if(path.extname(lib) == ".dll") {
          lib = lib.substring(0, lib.length - 3) + "lib";}
        return lib;
      }));
  }
}
Task.registerClass(LinkMSVCTask, "LinkMSVC");

export = LinkMSVCTask;