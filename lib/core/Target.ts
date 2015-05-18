/// <reference path="../../typings/tsd.d.ts" />
/* @flow weak */
//import Workspace = require('./Workspace');
import Workspace = require('./Workspace');
import Graph = require('./Graph');
import path = require('path');
import _ = require('underscore');


/**
 * @typedef {object} TargetDependency
 * @property {string} workspace
 * @property {[string]} targets
 * @property {string} target
 */

var noop = function() { arguments[arguments.length -1](); };
class Target extends Graph {
  type: string;
  public deepDependencies: Set<Target> = new Set<Target>();
  constructor(public workspace: Workspace, public info: Workspace.TargetInfo, public buildInfo: Workspace.BuildInfo) {
    super("Target " + info.name + ", env=" + buildInfo.env.name);
    buildInfo.target = this;
  }
  get targetName(): string { return this.info.name; }
  get env(): Workspace.Environment { return this.buildInfo.env; }

  configure(callback: ErrCallback) {
    var err = null;
    if(this.info.configure) {
      if(typeof  this.info.configure !== "function")
        return callback(new Error("'configure' must be a function with 'env' and 'target' arguments"));
      err = this.info.configure(this, this.env);
    }
    callback(err);
  }
  exports(targetToConfigure: Target, callback: ErrCallback) {
    this._export(this.info.exports, targetToConfigure, callback);
  }
  deepExports(targetToConfigure: Target, callback: ErrCallback) {
    this._export(this.info.deepExports, targetToConfigure, callback);
  }
  protected _export(exports: Workspace.TargetExportInfo, targetToConfigure: Target, callback: ErrCallback) {
    var err = null;
    if (exports) {
      err = exports.configure.call(this.info, targetToConfigure, targetToConfigure.buildInfo.env, this, this.buildInfo.env);
    }
    callback(err);
  }
  buildGraph(callback: ErrCallback) {
    this.graph((err, graph) => {
      if (err) return callback(err);
      this.inputs = new Set(graph.inputs);
      this.outputs = new Set(graph.outputs);
      callback();
    });
  }
  protected graph(callback:Graph.BuildGraphCallback) {
    callback(new Error("'graph' must be reimplemented by subclasses"));
  }
}

Target.prototype.type = "undefined";

export = Target;