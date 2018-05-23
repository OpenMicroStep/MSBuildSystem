import {FileElement, AttributeTypes, Reporter, File, CopyTask, Target} from '@openmicrostep/msbuildsystem.core';
import {CXXExecutable, PlistInfoTask} from '../index.priv';
import * as path from 'path';

export class CXXApplicationBundle extends CXXExecutable {
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

  defaultBundleBasePath() {
    return `${this.toolchain.bundleBasePath()}/${this.outputName}.${this.bundleExtension}`;
  }

  taskPlistInfo?: PlistInfoTask;
  taskCopyBundleResources?: CopyTask;

  buildGraph(reporter: Reporter) {
    super.buildGraph(reporter);
    if (this.bundleInfo) {
      this.taskPlistInfo = new PlistInfoTask(this, this.bundleInfo, File.getShared(this.absoluteBundleInfoPath()));
    }
    if (this.resources.length) {
      let copy = this.taskCopyBundleResources = new CopyTask("bundle resources", this);
      copy.willCopyFileGroups(reporter, this.resources, this.absoluteBundleResourcesBasePath());
    }
  }
}
Target.register(['cxx-application-bundle'], CXXApplicationBundle, {
  resources              : AttributeTypes.defaultsTo(FileElement.validateFileGroup, []),
  bundleExtension        : AttributeTypes.defaultsTo(AttributeTypes.validateString, "app"),
  bundleInfo             : AttributeTypes.defaultsTo(AttributeTypes.validateObject, null),
  bundleBasePath         : AttributeTypes.defaultsTo(AttributeTypes.validateString, (t: CXXApplicationBundle) =>  t.defaultBundleBasePath(), '${toolchain.bundleBasePath()}/${outputName}.${bundleExtension}'),
  bundleResourcesBasePath: AttributeTypes.defaultsTo(AttributeTypes.validateAnyString, "Resources"),
  bundleInfoPath         : AttributeTypes.defaultsTo(AttributeTypes.validateString, "Info.plist"),
});
