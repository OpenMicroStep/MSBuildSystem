import {declareTarget, resolver, FileElement, AttributeTypes, Reporter, AttributePath, File, CopyTask} from '@msbuildsystem/core';
import {CXXLibrary, PlistInfoTask, HeaderAliasTask} from '../index.priv';
import * as path from 'path';

@declareTarget({ type: 'CXXFramework' })
export class CXXFramework extends CXXLibrary {
  @resolver(FileElement.validateFileGroup)
  resources: FileElement.FileGroup[] = [];

  @resolver(AttributeTypes.validateString)
  bundleExtension: string = "framework";

  @resolver(AttributeTypes.validateObject)
  bundleInfo: any = null;

  @resolver(AttributeTypes.validateString)
  bundleBasePath: string = this.outputName + "." + this.bundleExtension;

  @resolver(AttributeTypes.validateString)
  bundleResourcesBasePath: string = "Resources";

  @resolver(AttributeTypes.validateString)
  bundleInfoPath: string = "Info.plist";

  publicHeadersBasePath: string = "Headers";
  publicHeadersFolder = "";

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
    this.compilerOptions.frameworkDirectories.push(dir);
    this.linkerOptions.frameworkDirectories.push(dir);
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


