import {Target, AttributeTypes, Reporter, FileElement, AttributePath, CopyTask} from '@openmicrostep/msbuildsystem.core';
import {CXXTarget, CXXLinkType} from '../index.priv';
import * as path from 'path';

export class CXXLibrary extends CXXTarget {
  static: boolean;
  publicHeaders: FileElement.FileGroup[];
  publicHeadersBasePath: string;
  publicHeadersFolder: string;

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
    let exports = this.exports.__createGeneratedComponent('library');
    let linkerOptions = {};
    linkerOptions[this.linkType === CXXLinkType.STATIC ? "archives" : "libraries"] = [this.exportsPath(this.sysroot.linkFinalPath())];
    exports["compilerOptions"] = [{ includeDirectories: [this.exportsPath(this.absolutePublicHeadersBasePath())] }];
    exports["linkerOptions"] = [linkerOptions];
  }
}
Target.register(['CXXLibrary'], CXXLibrary, {
  static                 : AttributeTypes.defaultsTo(AttributeTypes.validateBoolean, false) ,
  publicHeaders          : FileElement.validateFileGroup ,
  publicHeadersBasePath  : AttributeTypes.defaultsTo(AttributeTypes.validateString, "includes") ,
  publicHeadersFolder    : AttributeTypes.defaultsTo(AttributeTypes.validateString, (t: CXXTarget) => t.outputName, '${outputName}'),
});
