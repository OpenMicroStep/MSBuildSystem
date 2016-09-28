import {declareTarget, resolver, FileElement, AttributeResolvers, AttributeTypes, Reporter} from '@msbuildsystem/core';
import {CopyTask} from '@msbuildsystem/foundation';
import {CXXLibrary, CXXLibraryGraph, PlistInfoTask, HeaderAliasTask} from '../index.priv';
import * as path from 'path';


export type CXXFrameworkGraph = CXXLibraryGraph & {
  aliasHeadersTask?: HeaderAliasTask,
  plistInfoTask?: PlistInfoTask,
  copyBundleResourcesTask?: CopyTask
};

@declareTarget({ type: 'CXXFramework' })
export class CXXFramework extends CXXLibrary {
  @resolver(FileElement.fileGroupResolver)
  resources: FileElement.FileGroup[];

  @resolver(AttributeResolvers.stringResolver)
  bundleExtension: string = "framework";

  @resolver(new AttributeResolvers.SimpleResolver(AttributeTypes.validateObject))
  bundleInfo: any = null;

  @resolver(AttributeResolvers.stringResolver)
  bundleBasePath: string = this.outputName + "." + this.bundleExtension;

  @resolver(AttributeResolvers.stringResolver)
  bundleResourcesBasePath: string = "Resources";

  @resolver(AttributeResolvers.stringResolver)
  bundleInfoPath: string = "Info.plist";

  publicHeadersBasePath: string = "Headers";

  absoluteBundleBasePath() {
    return path.join(this.paths.output, this.bundleBasePath);
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
  absolutePublicHeadersAliasPath() {
    return path.join(this.paths.intermediates, "alias", this.outputName + ".framework", "Headers");
  }

  buildGraph(reporter: Reporter) : CXXFrameworkGraph {
    let ret = <CXXFrameworkGraph>super.buildGraph(reporter);
    if (ret.copyPublicHeadersTask) {
      let aliaspath = this.absolutePublicHeadersAliasPath();
      let h = new HeaderAliasTask(this, aliaspath);
      ret.copyPublicHeadersTask.foreach(h.willAliasHeader.bind(h));
      ret.aliasHeadersTask = h;
    }
    if (this.bundleInfo) {
      ret.plistInfoTask = new PlistInfoTask(this, this.bundleInfo, this.absoluteBundleInfoPath());
    }
    if (this.resources.length) {
      let copy = new CopyTask("bundle resources", this);
      copy.willCopyFileGroups(reporter, this.resources, this.absoluteBundleResourcesBasePath());
      ret.copyBundleResourcesTask = copy;
    }
    return ret;
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


