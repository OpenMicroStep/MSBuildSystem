import {Library} from './library';
import {Workspace, Target, declareTarget, Task, File, Barrier, Graph} from '../../core';
import {CopyTask} from '../../foundation';
import {CXXTarget} from '../cxxTarget';
import {PListInfoTask} from '../tasks/plistInfo';
import {HeaderAliasTask} from '../tasks/headerAlias';
import * as util from 'util';
import * as path from 'path';
import * as fs from 'fs';

@declareTarget({ type: 'framework' })
export class Framework extends Library {
  info: Framework.TargetInfo;
  bundleInfo: {[s: string]: any};
  bundleResources: {from:string, to:string}[] = [];

  configure(callback: ErrCallback) {
    if(this.info.bundleInfo)
      this.setBundleInfo(this.info.bundleInfo);
    this.addCompileOptions({ frameworkPath: [path.join(this.intermediates, "alias")] });
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
      targetToConfigure.addCompileOptions({ frameworkPath: [this.output] });
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
  buildPublicHeaderAliasPath() {
    return path.join(this.intermediates, "alias", this.outputName + ".framework", "Headers");
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

      if(this.publicHeaders.length) {
        var aliaspath = this.buildPublicHeaderAliasPath();
        var h = new HeaderAliasTask(this, aliaspath);
        this.publicHeaders.forEach((inFilename) => {
          var outFilename = path.basename(inFilename);
          if(this.publicHeadersPrefix)
            outFilename = path.join(this.publicHeadersPrefix, outFilename);
          this.publicHeaderMappers.forEach((mapper) => { outFilename = mapper(this, outFilename); });
          outFilename = path.join(aliaspath, outFilename);
          h.willAliasHeader(inFilename, outFilename);
        });
        this.applyTaskModifiers(h);
        this.inputs.forEach((task) => {
          if(task !== h) task.addDependency(h);
        });
      }

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


