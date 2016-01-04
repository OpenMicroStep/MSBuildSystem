/// <reference path="../../typings/tsd.d.ts" />
/* @flow weak */
'use strict';

import CompileTask = require('./Compile');
import File = require('../core/File');
import Task = require('../core/Task');
import LinkTask = require('./Link');
import Graph = require('../core/Graph');
import CXXTarget = require('../targets/_CXXTarget');

class LinkLibToolTask extends LinkTask {
  constructor(graph: Graph, compileTasks: CompileTask[], finalFile: File, type: CXXTarget.LinkType, provider?) {
    provider = provider || (type === CXXTarget.LinkType.STATIC ? {linker:"libtool"} : { compiler: "clang"});
    super(graph, compileTasks, finalFile, type, provider);
    if(this.type === CXXTarget.LinkType.STATIC) {
      this.appendArgs(["-static", "-o", finalFile.path]);
    }
    else {
      if(this.type === CXXTarget.LinkType.DYNAMIC)
        this.appendArgs(["-shared"]);
      this.appendArgs(["-o", finalFile.path]);
    }
    this.appendArgs(this.inputFiles.map(function (file) {
      return file.path;
    }));
  }
  addFlags(libs: string[]) {
    this.insertArgs(3, libs);
  }

  addLibraryFlags(libs: string[]) {
    if(this.type !== CXXTarget.LinkType.STATIC)
      this.appendArgs(libs);
  }

  addArchiveFlags(libs: string[]) {
    if(this.type !== CXXTarget.LinkType.STATIC) {
      libs.forEach((lib) => {
        this.appendArgs(["-force_load", lib]);
      });
    }
  }
}
Task.registerClass(LinkLibToolTask, "LinkLibTool");

export = LinkLibToolTask;