import {File, declareTask, Graph} from '@msbuildsystem/core';
import {ProcessTask} from '@msbuildsystem/foundation';
import {CXXLinkType} from '../index.priv';

@declareTask({ type: "cxxlink" })
export class LinkTask extends ProcessTask {
  type: CXXLinkType;
  constructor(graph: Graph, finalFile: File, type: CXXLinkType, provider) {
    super({ type: "link", name: finalFile.name }, graph, [], [finalFile], provider);
    this.type = type;
  }

  addObjFiles(files: File[]) {
    this.outputFiles.push(...files);
  }

  addLibraryFlags(libs: string[]) {
    this.addFlags(libs);
  }

  addArchiveFlags(libs: string[]) {
    this.addLibraryFlags(libs);
  }
}
