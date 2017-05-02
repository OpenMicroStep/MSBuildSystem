import {FileElement, AttributeTypes, Reporter, AttributePath, File, CopyTask, Target} from '@openmicrostep/msbuildsystem.core';
import {CXXLibrary, PlistInfoTask, HeaderAliasTask} from '../index.priv';
import * as path from 'path';

export class CXXFramework extends CXXLibrary {
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

  taskAliasHeader?: HeaderAliasTask;
  taskPlistInfo?: PlistInfoTask;
  taskCopyBundleResources?: CopyTask;

  configure(reporter: Reporter, path: AttributePath) {
    super.configure(reporter, path);
    let dir = File.getShared(this.absoluteBundleDirectory(), true);
    this.compilerOptions.frameworkDirectories.add(dir);
    this.linkerOptions.frameworkDirectories.add(dir);
  }

  buildGraph(reporter: Reporter) {
    super.buildGraph(reporter);
    if (this.bundleInfo) {
      this.taskPlistInfo = new PlistInfoTask(this, this.bundleInfo, this.absoluteBundleInfoPath());
    }
    if (this.resources.length) {
      let copy = this.taskCopyBundleResources = new CopyTask("bundle resources", this);
      copy.willCopyFileGroups(reporter, this.resources, this.absoluteBundleResourcesBasePath());
    }
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
Target.register(['CXXFramework'], CXXFramework, {
  resources              : FileElement.validateFileGroup ,
  bundleExtension        : AttributeTypes.defaultsTo(AttributeTypes.validateString, "framework") ,
  bundleInfo             : AttributeTypes.defaultsTo(AttributeTypes.validateObject, null) ,
  bundleBasePath         : AttributeTypes.defaultsTo(AttributeTypes.validateString, (t: CXXFramework) => t.outputName + "." + t.bundleExtension, '${outputName}.${bundleExtension}'),
  bundleResourcesBasePath: AttributeTypes.defaultsTo(AttributeTypes.validateString, "Resources") ,
  bundleInfoPath         : AttributeTypes.defaultsTo(AttributeTypes.validateString, "Info.plist") ,
  publicHeadersBasePath  : AttributeTypes.defaultsTo(AttributeTypes.validateString, "Headers") ,
  publicHeadersFolder    : AttributeTypes.defaultsTo(AttributeTypes.validateString, "") ,
});
