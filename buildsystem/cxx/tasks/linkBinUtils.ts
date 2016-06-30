import {Task, declareTask, Graph} from '../../core'
import {LinkTask} from './link';
import {CXXTarget, CXXLinkType} from '../cxxTarget';

@declareTask({ type: "link-binutils" })
export class LinkBinUtilsTask extends LinkTask {
  constructor(graph: Graph, compileTasks, finalFile, type: CXXLinkType, provider?) {
    provider = provider || (type === CXXLinkType.STATIC ? {archiver:"binutils"} : { linker: "gcc"});
    super(graph, compileTasks, finalFile, type, provider);
    switch(this.type) {
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
  addFlags(flags:string[]) {
    if(this.type !== CXXLinkType.STATIC)
      this.insertArgs(0, flags);
  }

  addLibraryFlags(libs: string[]) {
    if(this.type !== CXXLinkType.STATIC)
      this.appendArgs(libs);
  }

  addArchiveFlags(libs: string[]) {
    if(this.type !== CXXLinkType.STATIC) {
      this.appendArgs(["-Wl,--whole-archive"]);
      this.appendArgs(libs);
      this.appendArgs(["-Wl,--no-whole-archive"]);
    }
  }
}
