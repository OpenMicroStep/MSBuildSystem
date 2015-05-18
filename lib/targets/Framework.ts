/// <reference path="../../typings/tsd.d.ts" />
/* @flow weak */
import Workspace = require('../core/Workspace');
import Library = require('./Library');
import Target = require('../core/Target');
import CXXTarget = require('./_CXXTarget');
import util = require('util');
import path = require('path');

class Framework extends Library {
  shared = true;
  publicHeadersPrefix = null;

  exports(targetToConfigure: Target, callback: ErrCallback) {
    if(targetToConfigure instanceof CXXTarget) {
      targetToConfigure.addCompileMiddleware((options, task) => {
        //if(task.compiler.name !== "clang") return next("Only clang supports frameworks");
        task.addFlags(['-F' + this.buildInfo.targetOutput]);
      });
      targetToConfigure.addLinkMiddleware((options, task) => {
        if (task.linker.name === "clang")
          task.addFlags(['-F' + this.buildInfo.targetOutput, '-framework', this.targetName]);
        else
          task.addFlags([this.sysroot.linkFinalPath(this.buildInfo)]);
      });
      super.exports(targetToConfigure, callback);
    }
    else {
      callback(new Error("target " +  targetToConfigure.targetName + " is incompable with " + this.targetName));
    }
  }

  buildPublicHeaderPath(options) {
    return path.join(options.targetOutput, this.name + ".framework", "Headers");
  }
}

Framework.prototype.type = "framework";

export = Framework;

