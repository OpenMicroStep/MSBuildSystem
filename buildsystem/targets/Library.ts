import path = require('path');
import util = require('util');
import Graph = require('../core/Graph');
import CopyTask = require('../tasks/Copy');
import LinkTask = require('../tasks/Link');
import Target = require('./../core/Target');
import CXXTarget = require('./_CXXTarget');
import File = require('../core/File');
import Workspace = require('../core/Workspace');

class Library extends CXXTarget {
  publicHeaders = [];
  publicHeaderMappers = [];
  publicHeadersPrefix : string;

  configure(callback: ErrCallback) {
    this.publicHeadersPrefix = this.info.publicHeadersPrefix || this.info.name;

    if(this.info.publicHeaders)
      this.addPublicHeaders(this.workspace.resolveFiles(this.info.publicHeaders));
    this.linkType = this.info.static ? CXXTarget.LinkType.STATIC : CXXTarget.LinkType.DYNAMIC;
    super.configure(callback);
  }
  exports(targetToConfigure: Target, callback: ErrCallback) {
    if(targetToConfigure instanceof CXXTarget) {
      targetToConfigure.addIncludeDirectory(this.buildPublicHeaderPath());
      if (this.linkType === CXXTarget.LinkType.STATIC)
        targetToConfigure.addArchives([this.sysroot.linkFinalPath(this)]);
      else
        targetToConfigure.addLibraries([this.sysroot.linkFinalPath(this)]);
      super.exports(targetToConfigure, callback);
    }
    else {
      return callback(new Error("target " +  targetToConfigure.targetName + " is incompable with " + this.targetName));
    }
  }
  buildPublicHeaderPath() {
    return path.join(this.outputBasePath, this.env.directories.publicHeaders);
  }
  addWorkspacePublicHeaders(headers: string[]) {
    this.addPublicHeaders(this.workspace.resolveFiles(headers));
  }
  addPublicHeaders(headers: string[]) {
    var files = File.buildList(this.workspace.directory, headers);
    this.publicHeaders.push(...files);
  }
  setPublicHeadersPrefix(prefix) {
    this.publicHeadersPrefix = prefix;
  }
  addPublicHeaderMapper(mapper) {
    this.publicHeaderMappers.push(mapper);
  }
  buildGraph(callback: ErrCallback) {
    super.buildGraph((err) => {
      if(err) return callback(err);

      if(this.publicHeaders.length) {
        var copy = new CopyTask("public headers", this);
        this.publicHeaders.forEach((inFilename) => {
          var outFilename = path.basename(inFilename);
          if(this.publicHeadersPrefix)
            outFilename = path.join(this.publicHeadersPrefix, outFilename);
          this.publicHeaderMappers.forEach((mapper) => { outFilename = mapper(this, outFilename); });
          outFilename = path.join(this.buildPublicHeaderPath(), outFilename);
          copy.willCopyFile(inFilename, outFilename);
        });
        this.applyTaskModifiers(copy);
        this.inputs.forEach((task) => {
          if(task !== copy) task.addDependency(copy);
        });
      }
      callback();
    });
  }
}
Target.registerClass(Library, "Library");

export = Library;
