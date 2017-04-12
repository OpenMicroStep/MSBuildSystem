import {declareTask, Graph, File} from '@openmicrostep/msbuildsystem.core';
import {Arg} from '@openmicrostep/msbuildsystem.foundation';
import {CXXLinkType, LinkTask} from '../index.priv';

@declareTask({ type: "link-libtool" })
export class LinkLibToolTask extends LinkTask {
  constructor(graph: Graph, finalFile: File, type: CXXLinkType, provider?) {
    provider = provider || (type === CXXLinkType.STATIC ? {linker: "libtool"} : { compiler: "clang"});
    super(graph, finalFile, type, provider);
    if (this.type === CXXLinkType.STATIC) {
      this.appendArgs(["-static", "-o", [finalFile]]);
    }
    else {
      if (this.type === CXXLinkType.DYNAMIC)
        this.appendArgs(["-dynamic"]);
      this.appendArgs(["-o", [finalFile]]);
    }
    this.appendArgs(this.inputFiles.map(function (file) {
      return file.path;
    }));
  }
  addFlags(libs: Arg[]) {
    this.insertArgs(3, libs);
  }

  addObjFiles(files: File[]) {
    this.addFlags(files.map(f => [f]));
    super.addObjFiles(files);
  }

  addLibraryFlags(libs: Arg[]) {
    if (this.type !== CXXLinkType.STATIC)
      this.appendArgs(libs);
  }

  addArchiveFlags(libs: Arg[]) {
    if (this.type !== CXXLinkType.STATIC) {
      libs.forEach((lib) => {
        this.appendArgs(["-force_load", lib]);
      });
    }
  }
}
