import {FileElement, AttributeTypes, Reporter, PathReporter, File, CopyTask, Target} from '@openmicrostep/msbuildsystem.core';
import {
  CXXExportable, PlistInfoTask, HeaderAliasTask, CXXLinkType
} from '../index.priv';
import * as path from 'path';

export class CXXFramework extends CXXExportable {
  resources: FileElement.FileGroup[] = [];
  bundleExtension: string;
  bundleInfo: any;
  bundleBasePath: string;
  bundleResourcesBasePath: string;
  bundleInfoPath: string;

  absoluteBundleDirectory() {
    return this.paths.output;
  }
  absoluteBundleBasePath() {
    return path.join(this.absoluteBundleDirectory(), this.bundleBasePath);
  }
  absoluteBundleResourcesBasePath() {
    return path.join(this.absoluteBundleBasePath(), this.bundleResourcesBasePath);
  }
  absoluteBundleInfoPath() {
    return path.join(this.absoluteBundleBasePath(), "Info.plist");
  }

  absolutePublicHeadersBasePath() {
    return path.join(this.absoluteBundleBasePath(), this.publicHeadersBasePath);
  }

  absolutePublicHeadersAliasBasePath() {
    return path.join(this.paths.intermediates, `halias`);
  }

  absolutePublicHeadersAliasFrameworkPath() {
    return path.join(this.absolutePublicHeadersAliasBasePath(), `${this.outputName}.${this.bundleExtension}`, "Headers");
  }

  defaultBundleBasePath() {
    return `${this.toolchain.bundleBasePath()}/${this.outputName}.${this.bundleExtension}`;
  }

  taskAliasHeader?: HeaderAliasTask;
  taskPlistInfo?: PlistInfoTask;
  taskCopyBundleResources?: CopyTask;

  configure(at: PathReporter) {
    super.configure(at);
    this.linkType = CXXLinkType.DYNAMIC;

    let dir = File.getShared(this.absoluteBundleDirectory(), true);
    this.compilerOptions.frameworkDirectories.push(dir);
    this.linkerOptions.frameworkDirectories.push(dir);

    let halias = File.getShared(this.absolutePublicHeadersAliasBasePath(), true);
    this.compilerOptions.frameworkDirectories.unshift(halias);
  }

  buildGraph(reporter: Reporter) {
    super.buildGraph(reporter);
    if (this.bundleInfo) {
      this.taskPlistInfo = new PlistInfoTask(this, this.bundleInfo, File.getShared(this.absoluteBundleInfoPath()));
    }
    if (this.resources.length) {
      let copy = this.taskCopyBundleResources = new CopyTask("bundle resources", this);
      copy.willCopyFileGroups(reporter, this.resources, this.absoluteBundleResourcesBasePath());
    }
    if (this.publicHeaders.length) {
      let alias = this.taskAliasHeader = new HeaderAliasTask("public headers alias", this);
      alias.willAliasFileGroups(reporter, this.publicHeaders, this.absolutePublicHeadersAliasFrameworkPath());
      this.toolchain.addDependency(alias);
    }
  }

  configureExports(reporter: Reporter) {
    super.configureExports(reporter);
    let dir = this.exportsPath(path.dirname(this.absoluteBundleBasePath()));
    this.exports["compilerOptions="] = { is: "component",
      frameworkDirectories: [dir],
    };
    this.exports["linkerOptions="] = { is: "component",
      frameworks: [this.outputFinalName || this.outputName],
      frameworkDirectories: [dir],
    };
    let exports = { is: 'component', name: this.name.type,
      compilerOptions: "=compilerOptions",
      linkerOptions: "=linkerOptions",
    };
    this.exports["generated="].components.push(exports);
  }

/*
  exports(targetToConfigure: Target, callback: ErrCallback) {
    if(targetToConfigure instanceof CXXTarget) {
      targetToConfigure.addCompileOptions({ frameworkPath: [this.output] });
      targetToConfigure.addLibraries([this.sysroot.linkFinalPath(this)]);
      CXXTarget.prototype.exports.call(this, targetToConfigure, callback);
    }
    else {
      callback(new Error("target " +  targetToConfigure.targetName + " is incompable with " + this.targetName));
    }
  }
*/
}
Target.register(['cxx-framework'], CXXFramework, {
  resources              : AttributeTypes.defaultsTo(FileElement.validateFileGroup, []),
  bundleExtension        : AttributeTypes.defaultsTo(AttributeTypes.validateString, "framework"),
  bundleInfo             : AttributeTypes.defaultsTo(AttributeTypes.validateObject, null),
  bundleBasePath         : AttributeTypes.defaultsTo(AttributeTypes.validateString, (t: CXXFramework) =>  t.defaultBundleBasePath(), '${toolchain.bundleBasePath()}/${outputName}.${bundleExtension}'),
  bundleResourcesBasePath: AttributeTypes.defaultsTo(AttributeTypes.validateAnyString, "Resources"),
  bundleInfoPath         : AttributeTypes.defaultsTo(AttributeTypes.validateString, "Info.plist"),
  publicHeaders          : AttributeTypes.defaultsTo(FileElement.validateFileGroup, []),
  publicHeadersBasePath  : AttributeTypes.defaultsTo(AttributeTypes.validateAnyString, "Headers"),
  publicHeadersFolder    : AttributeTypes.defaultsTo(AttributeTypes.validateAnyString, ""),
});
