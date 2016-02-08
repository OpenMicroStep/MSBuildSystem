import Workspace = require('../core/Workspace');
import Library = require('./Library');
import Target = require('../core/Target');
import Task = require('../core/Task');
import File = require('../core/File');
import Barrier = require('../core/Barrier');
import Graph = require('../core/Graph');
import CXXTarget = require('./_CXXTarget');
import PListInfoTask = require('../tasks/PlistInfo');
import CopyTask = require('../tasks/Copy');
import util = require('util');
import path = require('path');
import fs = require('fs');

class HeaderAliasTask extends Task {
  public steps : [File, File][] = [];
  aliaspath: string;

  constructor(graph: Graph, aliaspath: string) {
    super({ type: "headeralias", name: "generate header aliases" }, graph);
    this.aliaspath = aliaspath;
  }

  /** Make this task copy file 'inFile' to 'outFile' */
  willAliasHeader(inFile: string, outFile: string) {
    this.steps.push([File.getShared(inFile), File.getShared(outFile)]);
  }

  run(fstep) {
    var i = 0;
    var step = () => {
      if (i < this.steps.length) {
        var s = this.steps[i++];
        File.ensure(fstep, [s[1]], {ensureDir: true}, (err, changed) => {
          if (err) { fstep.error(err); return fstep.continue(); }
          if (changed) {
            fs.writeFile(s[1].path, "#import \"" + path.relative(this.aliaspath, s[0].path) + "\"\n", 'utf8', (err) => {
              if (err) { fstep.error(err); return fstep.continue(); }
              step();
            });
          }
          else {
            step();
          }
        });
      }
      else {
        fstep.continue();
      }
    }
    step();
  }
  clean(fstep) {
    var i = 0;
    var step = () => {
      if (i < this.steps.length) {
        var s = this.steps[i++];
        fs.unlink(s[0].path, (err) => {
          if (err) { fstep.error(err); return fstep.continue(); }
          step();
        });
      }
      else {
        fstep.continue();
      }
    }
    step();
  }

  listOutputFiles(set: Set<File>) {
    this.steps.forEach((step) => { set.add(step[1]); });
  }
}
Task.registerClass(HeaderAliasTask, "HeaderAlias");

class Framework extends Library {
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
Target.registerClass(Framework, "Framework");

module Framework {
  export interface TargetInfo extends CXXTarget.TargetInfo {
    bundleInfo: {[s: string]: any};
    bundleResources: ({from:(string | string[]), to:string} | string)[];
  }
}

export = Framework;

