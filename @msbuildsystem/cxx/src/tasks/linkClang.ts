import {declareTask, Graph, File} from '@msbuildsystem/core';
import {Arg} from '@msbuildsystem/foundation';
import {CXXLinkType, LinkTask, LinkerOptions} from '../index.priv';

@declareTask({ type: "link-clang" })
export class LinkClangTask extends LinkTask {
  constructor(graph: Graph, finalFile: File, type: CXXLinkType, provider = { compiler: "clang"}) {
    super(graph, finalFile, type, provider);
    if (this.type === CXXLinkType.STATIC) {
      this.appendArgs(["-static", "-o", [finalFile]]);
    }
    else {
      if (this.type === CXXLinkType.DYNAMIC)
        this.appendArgs(["-shared"]);
      this.appendArgs(["-o", [finalFile]]);
    }
    this.appendArgs(this.inputFiles.map(function (file) {
      return file.path;
    }));
  }

  addOptions(options: LinkerOptions) {
    this.appendArgs(options.archives);
    this.appendArgs(options.libraries);
    super.addOptions(options);
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
