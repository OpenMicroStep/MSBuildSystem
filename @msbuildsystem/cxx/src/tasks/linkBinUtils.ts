import {declareTask, Graph} from '@msbuildsystem/core';
import {CXXLinkType, LinkTask} from '../index.priv';

@declareTask({ type: "link-binutils" })
export class LinkBinUtilsTask extends LinkTask {
  constructor(graph: Graph, finalFile, type: CXXLinkType, provider?) {
    provider = provider || (type === CXXLinkType.STATIC ? {archiver: "binutils"} : { linker: "gcc"});
    super(graph, finalFile, type, provider);
    switch (this.type) {
      case CXXLinkType.STATIC:
        this.appendArgs(["rcs", [finalFile]]);
        break;
      case CXXLinkType.DYNAMIC:
        this.appendArgs(["-shared", "-o", [finalFile]]);
        break;
      case CXXLinkType.EXECUTABLE:
        this.appendArgs(["-o", [finalFile]]);
        break;
    }
    this.appendArgs(this.inputFiles.map(function (file) {
      return [file];
    }));
  }
  addFlags(flags: string[]) {
    if (this.type !== CXXLinkType.STATIC)
      this.insertArgs(0, flags);
  }

  addLibraryFlags(libs: string[]) {
    if (this.type !== CXXLinkType.STATIC)
      this.appendArgs(libs);
  }

  addArchiveFlags(libs: string[]) {
    if (this.type !== CXXLinkType.STATIC) {
      this.appendArgs(["-Wl,--whole-archive"]);
      this.appendArgs(libs);
      this.appendArgs(["-Wl,--no-whole-archive"]);
    }
  }
}