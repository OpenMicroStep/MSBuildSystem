import {declareTarget, Target, resolver, FileElement, Reporter, AttributeTypes} from '@msbuildsystem/core';
import {CopyTask} from './index';
import * as path from 'path';

@declareTarget({ type: 'Copy' })
export class CopyTarget extends Target {
  @resolver(FileElement.validateFileGroup)
  copyFiles: FileElement.FileGroup[];

  @resolver(AttributeTypes.validateString)
  copyBasePath: string = "";


  absoluteCopyBasePath() {
    return path.join(this.paths.output, this.copyBasePath);
  }

  buildGraph(reporter: Reporter) {
    super.buildGraph(reporter);
    if (this.copyFiles.length) {
      let copy = new CopyTask("bundle resources", this);
      copy.willCopyFileGroups(reporter, this.copyFiles, this.absoluteCopyBasePath());
    }
  }
}


