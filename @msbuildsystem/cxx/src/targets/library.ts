import {declareTarget, resolver, AttributeResolvers, AttributeTypes, Reporter, FileElement} from '@msbuildsystem/core';
import {CopyTask} from '@msbuildsystem/foundation';
import {CXXTarget, CXXLinkType} from '../index.priv';
import * as path from 'path';

@declareTarget({ type: "Library" })
export class CXXLibrary extends CXXTarget {
  @resolver(new AttributeResolvers.SimpleResolver(AttributeTypes.validateBoolean))
  static: boolean = false;

  @resolver(FileElement.fileGroupResolver)
  publicHeaders: FileElement.FileGroup[] = [];

  @resolver(AttributeResolvers.stringResolver)
  publicHeadersBasePath: string = "includes";

  taskCopyPublicHeaders?: CopyTask;

  configure(reporter: Reporter) {
    super.configure(reporter);
    this.linkType = this.static ? CXXLinkType.STATIC : CXXLinkType.DYNAMIC;
  }

  absolutePublicHeadersBasePath() {
    return path.join(this.paths.output, this.publicHeadersBasePath);
  }

  buildGraph(reporter: Reporter) {
    super.buildGraph(reporter);
    if (this.publicHeaders.length) {
      let copy = this.taskCopyPublicHeaders = new CopyTask("public headers", this);
      copy.willCopyFileGroups(reporter, this.publicHeaders, this.absolutePublicHeadersBasePath());
      this.sysroot.addDependency(copy); // is this dependency really necessary ?
    }
  }

  /*
  exports(targetToConfigure: Target, callback: ErrCallback) {
    if (targetToConfigure instanceof CXXTarget) {
      targetToConfigure.addIncludeDirectory(this.buildPublicHeaderPath());
      if (this.linkType === CXXTarget.LinkType.STATIC)
        targetToConfigure.addArchives([this.sysroot.linkFinalPath(this)]);
      else
        targetToConfigure.addLibraries([this.sysroot.linkFinalPath(this)]);
      super.exports(targetToConfigure, callback);
    }
    else {
      return callback(new Error("target " +  targetToConfigure.targetName + " is incompable with " + this.targetName));
    }
  }*/
}
