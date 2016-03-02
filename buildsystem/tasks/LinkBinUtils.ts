import LinkTask = require('./Link');
import Task = require('../core/Task');
import Graph = require('../core/Graph');
import CXXTarget = require('../targets/_CXXTarget');

class LinkBinUtilsTask extends LinkTask {
  constructor(graph: Graph, compileTasks, finalFile, type: CXXTarget.LinkType, provider?) {
    provider = provider || (type === CXXTarget.LinkType.STATIC ? {archiver:"binutils"} : { linker: "gcc"});
    super(graph, compileTasks, finalFile, type, provider);
    switch(this.type) {
      case CXXTarget.LinkType.STATIC:
        this.appendArgs(["rcs", [finalFile]]);
        break;
      case CXXTarget.LinkType.DYNAMIC:
        this.appendArgs(["-shared", "-o", [finalFile]]);
        break;
      case CXXTarget.LinkType.EXECUTABLE:
        this.appendArgs(["-o", [finalFile]]);
        break;
    }
    this.appendArgs(this.inputFiles.map(function (file) {
      return [file];
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

  addArchiveFlags(libs: string[]) {
    if(this.type !== CXXTarget.LinkType.STATIC) {
      this.appendArgs(["-Wl,--whole-archive"]);
      this.appendArgs(libs);
      this.appendArgs(["-Wl,--no-whole-archive"]);
    }
  }
}
Task.registerClass(LinkBinUtilsTask, "LinkBinUtils");

export = LinkBinUtilsTask;