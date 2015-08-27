/// <reference path="../../typings/tsd.d.ts" />
/* @flow weak */
'use strict';

import Framework = require('./Framework');
import Target = require('../core/Target');
import path = require('path');

class Bundle extends Framework {
  info: Bundle.TargetInfo;
  bundleExtension: string;

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

module Bundle {
  export interface TargetInfo extends Framework.TargetInfo {
    bundleExtension: string;
  }
}

Target.registerClass(Bundle, "Bundle");

export = Bundle;
