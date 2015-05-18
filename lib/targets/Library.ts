/// <reference path="../../typings/tsd.d.ts" />
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
  public publicHeaders = [];
  public publicHeaderMappers = [];
  public publicHeadersPrefix : string;
  public shared: boolean;

  configure(callback: ErrCallback) {
    this.publicHeadersPrefix = this.info.publicHeadersPrefix || this.info.name;

    if(this.info.publicHeaders)
      this.addPublicHeaders(this.workspace.resolveFiles(this.info.publicHeaders));
    this.shared = !!this.info.shared;
    super.configure(callback);
  }
  exports(targetToConfigure: Target, callback: ErrCallback) {
    if(targetToConfigure instanceof CXXTarget) {
      targetToConfigure.addIncludeDirectory(this.buildPublicHeaderPath(this.buildInfo));
      targetToConfigure.addLinkMiddleware((options, task) => {
        task.appendArgs(['-L' + this.buildInfo.targetOutput, '-l' + this.targetName]);
      });
      super.exports(targetToConfigure, callback);
    }
    else {
      return callback(new Error("target " +  targetToConfigure.targetName + " is incompable with " + this.targetName));
    }
  }
  buildPublicHeaderPath(options) {
    return path.join(options.output, options.env.directories.publicHeaders);
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
  graph(callback: Graph.BuildGraphCallback) {
    super.graph((err, graph) => {
      if(err) return callback(err);

      if(this.publicHeaders.length) {
        var copy = new CopyTask("Copy public headers of " + this.targetName + ", env=" + this.env.name);
        this.publicHeaders.forEach((inFilename) => {
          var outFilename = path.basename(inFilename);
          if(this.publicHeadersPrefix)
            outFilename = path.join(this.publicHeadersPrefix, outFilename);
          this.publicHeaderMappers.forEach((mapper) => { outFilename = mapper(this.buildInfo, outFilename); });
          outFilename = path.join(this.buildPublicHeaderPath(this.buildInfo), outFilename);
          copy.willCopyFile(inFilename, outFilename);
        });
        graph.addDependencyOnInputs(copy);
      }
      callback(null, graph);
    });
  }
}

Library.prototype.type = "library";

export = Library;
