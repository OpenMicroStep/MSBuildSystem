import {declareTarget, Target, resolver, FileElement, AttributeResolvers, Reporter} from '@msbuildsystem/core';
import {CopyTask} from './index';
import * as path from 'path';

@declareTarget({ type: 'Copy' })
export class CopyTarget extends Target {
  @resolver(FileElement.fileGroupResolver)
  copyFiles: FileElement.FileGroup[];

  @resolver(AttributeResolvers.stringResolver)
  copyBasePath: string = "";


  absoluteCopyBasePath() {
    return path.join(this.paths.output, this.copyBasePath);
  }

  buildGraph(reporter: Reporter) : { copy?: CopyTask } {
    if (this.copyFiles.length) {
      let copy = new CopyTask("bundle resources", this);
      copy.willCopyFileGroups(reporter, this.copyFiles, this.absoluteCopyBasePath());
      return { copy: copy };
    }
    return {};
  }
}


