import {Target, AttributeTypes, Reporter, FileElement, AttributePath, CopyTask} from '@openmicrostep/msbuildsystem.core';
import {CXXTarget, CXXLinkType} from '../index.priv';
import * as path from 'path';

export class CXXExportable extends CXXTarget {
  publicHeaders: FileElement.FileGroup[];
  publicHeadersBasePath: string;
  publicHeadersFolder: string;

  taskCopyPublicHeaders?: CopyTask;

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
    }
  }
}

export class CXXLibrary extends CXXExportable {
  static: boolean;

  configure(reporter: Reporter, path: AttributePath) {
    super.configure(reporter, path);
    this.linkType = this.static ? CXXLinkType.STATIC : CXXLinkType.DYNAMIC;
  }

  configureExports(reporter: Reporter) {
    super.configureExports(reporter);
    let compilerOptions = this.exports["compilerOptions="] = { is: "component",
      includeDirectories: [] as string[]
    };
    if (this.linkType === CXXLinkType.DYNAMIC) {
      this.exports["linkerOptions="] = { is: "component",
        libraries: [this.toolchain.linkExportName()],
        libDirectories: [this.exportsPath(this.toolchain.linkBasePath())],
      };
    }
    else if (this.linkType === CXXLinkType.STATIC) {
      this.exports["linkerOptions="] = { is: "component",
        archives: [this.toolchain.linkExportName()],
        libDirectories: [this.exportsPath(this.toolchain.linkBasePath())],
      };
    }
    let exports = { is: 'component', name: this.name.type,
      compilerOptions: "=compilerOptions",
      linkerOptions: "=linkerOptions",
    };
    if (this.publicHeaders.length) {
      let p = this.exportsPath(this.absolutePublicHeadersBasePath());
      compilerOptions.includeDirectories.push(p);
    }
    this.exports["generated="].components.push(exports);
  }
}
Target.register(['cxx-library'], CXXLibrary, {
  static                 : AttributeTypes.defaultsTo(AttributeTypes.validateBoolean, false) ,
  publicHeaders          : AttributeTypes.defaultsTo(FileElement.validateFileGroup, []),
  publicHeadersBasePath  : AttributeTypes.defaultsTo(AttributeTypes.validateAnyString, "include"),
  publicHeadersFolder    : AttributeTypes.defaultsTo(AttributeTypes.validateAnyString, (t: CXXTarget) => t.outputName, '${outputName}'),
});
