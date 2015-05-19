/// <reference path="../../typings/tsd.d.ts" />
/* @flow weak */
import CompileTask = require('./Compile');
import File = require('../core/File');
import Task = require('../core/Task');
import LinkTask = require('./Link');
import CXXTarget = require('../targets/_CXXTarget');

class LinkLibToolTask extends LinkTask {
  constructor(compileTasks: CompileTask[], finalFile: File, type: CXXTarget.LinkType) {
    super(compileTasks, finalFile, type);
    if(this.type === CXXTarget.LinkType.STATIC) {
      this.bin = "libtool";
      this.appendArgs(["-static", "-o", finalFile.path]);
    }
    else {
      this.bin = "clang";
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
      this.addFlags(libs);
  }
}
Task.registerClass(LinkLibToolTask, "LinkLibTool");

export = LinkLibToolTask;