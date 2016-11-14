import {declareTarget, resolver, AttributeTypes, Reporter, FileElement, AttributePath} from '@msbuildsystem/core';
import {CopyTask} from '@msbuildsystem/foundation';
import {CXXTarget, CXXLinkType} from '../index.priv';
import * as path from 'path';

@declareTarget({ type: "CXXLibrary" })
export class CXXLibrary extends CXXTarget {
  @resolver(AttributeTypes.validateBoolean)
  static: boolean = false;

  @resolver(FileElement.validateFileGroup)
  publicHeaders: FileElement.FileGroup[] = [];

  @resolver(AttributeTypes.validateString)
  publicHeadersBasePath: string = "includes";

  @resolver(AttributeTypes.validateString)
  publicHeadersFolder: string = this.outputName;

  taskCopyPublicHeaders?: CopyTask;

  configure(reporter: Reporter, path: AttributePath) {
    super.configure(reporter, path);
    this.linkType = this.static ? CXXLinkType.STATIC : CXXLinkType.DYNAMIC;
  }

  absolutePublicHeadersBasePath() {
    return path.join(this.paths.output, this.publicHeadersBasePath);
  }

  absolutePublicHeadersPath() {
    return path.join(this.absolutePublicHeadersBasePath(), this.publicHeadersFolder);
  }

  buildGraph(reporter: Reporter) {
    super.buildGraph(reporter);
    if (this.publicHeaders.length) {
      let copy = this.taskCopyPublicHeaders = new CopyTask("public headers", this);
      copy.willCopyFileGroups(reporter, this.publicHeaders, this.absolutePublicHeadersPath());
      this.sysroot.addDependency(copy);
    }
  }

  configureExports(reporter: Reporter) {
    super.configureExports(reporter);
    let exports = this.exports;
    let linkerOptions = {};
    linkerOptions[this.linkType === CXXLinkType.STATIC ? "archives" : "libraries"] = [exports.__filepath(this.sysroot.linkFinalPath())];
    exports["compilerOptions"] = [{ includeDirectories: [exports.__filepath(this.absolutePublicHeadersBasePath())] }];
    exports["linkerOptions"] = [linkerOptions];
  }
}
