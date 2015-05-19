/// <reference path="../../typings/tsd.d.ts" />
/* @flow weak */
import LinkTask = require('./Link');
import Task = require('../core/Task');
import CXXTarget = require('../targets/_CXXTarget');

class LinkBinUtilsTask extends LinkTask {
  constructor(compileTasks, finalFile, type: CXXTarget.LinkType) {
    super(compileTasks, finalFile, type);
    switch(this.type) {
      case CXXTarget.LinkType.STATIC:
        this.appendArgs(["rcs", finalFile.path]);
        break;
      case CXXTarget.LinkType.DYNAMIC:
        this.appendArgs(["-shared", "-o", finalFile.path]);
        break;
      case CXXTarget.LinkType.EXECUTABLE:
        this.appendArgs(["-o", finalFile.path]);
        break;
    }
    this.appendArgs(this.inputFiles.map(function (file) {
      return file.path;
    }));
  }
  addFlags(flags:string[]) {
    if(this.type !== CXXTarget.LinkType.STATIC)
      this.insertArgs(0, flags);
  }

  addLibraryFlags(libs: string[]) {
    if(this.type !== CXXTarget.LinkType.STATIC)
      this.appendArgs(libs);
  }
}
Task.registerClass(LinkBinUtilsTask, "LinkBinUtils");

export = LinkBinUtilsTask;