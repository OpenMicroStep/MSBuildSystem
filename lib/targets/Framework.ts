/// <reference path="../../typings/tsd.d.ts" />
/* @flow weak */
import Workspace = require('../core/Workspace');
import Library = require('./Library');
import Target = require('../core/Target');
import CXXTarget = require('./_CXXTarget');
import util = require('util');
import path = require('path');

class Framework extends Library {
  configure(callback: ErrCallback) {
    super.configure((err) => {
      this.publicHeadersPrefix = null;
      callback(err);
    });
  }

  exports(targetToConfigure: Target, callback: ErrCallback) {
    if(targetToConfigure instanceof CXXTarget) {
      targetToConfigure.addCompileFlags(['-F' + this.directories.targetOutput]);
      targetToConfigure.addLinkFlags([this.sysroot.linkFinalPath(this)]);
      CXXTarget.prototype.exports.call(this, targetToConfigure, callback);
    }
    else {
      callback(new Error("target " +  targetToConfigure.targetName + " is incompable with " + this.targetName));
    }
  }

  buildPublicHeaderPath() {
    return path.join(this.directories.targetOutput, this.outputName + ".framework", "Headers");
  }
}
Target.registerClass(Framework, "Framework");

export = Framework;

