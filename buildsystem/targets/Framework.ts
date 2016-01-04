/// <reference path="../../typings/tsd.d.ts" />
/* @flow weak */
'use strict';

import Workspace = require('../core/Workspace');
import Library = require('./Library');
import Target = require('../core/Target');
import CXXTarget = require('./_CXXTarget');
import PListInfoTask = require('../tasks/PlistInfo');
import CopyTask = require('../tasks/Copy');
import util = require('util');
import path = require('path');

class Framework extends Library {
  info: Framework.TargetInfo;
  bundleInfo: {[s: string]: any};
  bundleResources: {from:string, to:string}[] = [];

  configure(callback: ErrCallback) {
    if(this.info.bundleInfo)
      this.setBundleInfo(this.info.bundleInfo);
    super.configure((err) => {
      this.publicHeadersPrefix = null;
      callback(err);
    });
  }

  setBundleInfo(info: {[s: string]: any}) {
    this.bundleInfo = info;
  }
  addBundleResources(resources: ({from:(string | string[]), to:string} | string)[]) {
    resources.forEach((rsc) => {
      if(typeof rsc === "string") {
        this.bundleResources.push({from:this.resolvePath(rsc), to:path.basename(rsc)});
      }
      else if(typeof rsc.from === "string" ) {
        this.bundleResources.push({from:this.resolvePath(<string>rsc.from), to:rsc.to});
      }
      else {
        (<string[]>rsc.from).forEach((from) => {
          this.bundleResources.push({from: this.resolvePath(from), to: path.join(rsc.to, from)});
        });
      }
    });
  }

  exports(targetToConfigure: Target, callback: ErrCallback) {
    if(targetToConfigure instanceof CXXTarget) {
      targetToConfigure.addCompileFlags(['-F' + this.output]);
      targetToConfigure.addLibraries([this.sysroot.linkFinalPath(this)]);
      CXXTarget.prototype.exports.call(this, targetToConfigure, callback);
    }
    else {
      callback(new Error("target " +  targetToConfigure.targetName + " is incompable with " + this.targetName));
    }
  }

  buildBundlePath() {
    return path.join(this.output, this.outputName + ".framework");
  }
  buildBundleContentsPath() {
    return this.buildBundlePath();
  }
  buildPublicHeaderPath() {
    return path.join(this.buildBundleContentsPath(), "Headers");
  }
  buildResourcesPath() {
    return path.join(this.buildBundleContentsPath(), "Resources");
  }
  buildInfoPath() {
    return path.join(this.buildResourcesPath(), "Info.plist");
  }

  buildGraph(callback: ErrCallback) {
    super.buildGraph((err) => {
      if(err) return callback(err);

      if(this.bundleInfo) {
        var plist = new PListInfoTask(this, this.bundleInfo, this.buildInfoPath());
        this.applyTaskModifiers(plist);
      }
      if(this.bundleResources.length) {
        var rscPath = this.buildResourcesPath();
        var copy = new CopyTask("bundle resources", this);
        this.bundleResources.forEach((rsc) => {
          copy.willCopyFile(rsc.from, rsc.to ? path.join(rscPath, rsc.to) : rscPath);
        });
        this.applyTaskModifiers(copy);
      }
      callback();
    });
  }
}
Target.registerClass(Framework, "Framework");

module Framework {
  export interface TargetInfo extends CXXTarget.TargetInfo {
    bundleInfo: {[s: string]: any};
    bundleResources: ({from:(string | string[]), to:string} | string)[];
  }
}

export = Framework;

