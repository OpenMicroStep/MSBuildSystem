import {Framework} from './framework';
import {Target, declareTarget} from '../../core';
import path from 'path';

@declareTarget({ type: "Bundle" })
export class Bundle extends Framework {

  configure(callback: ErrCallback) {
    this.bundleExtension = this.info.bundleExtension || "bundle";
    super.configure(callback);
  }
  buildBundlePath() {
    return path.join(this.output, this.outputName + "." + this.bundleExtension);
  }
  buildBundleContentsPath() {
    return path.join(this.buildBundlePath(), "Contents");
  }
  buildInfoPath() {
    return path.join(this.buildBundleContentsPath(), "Info.plist");
  }
}

