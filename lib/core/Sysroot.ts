/// <reference path="../../typings/tsd.d.ts" />
/* @flow weak */
import CXXTarget = require('../targets/_CXXTarget');
import Framework = require('../targets/Framework');
import Task = require('./task');
import CompileTask = require('../tasks/Compile');
import Workspace = require('./Workspace');
import File = require('./File');
import _ = require('underscore');
import util = require('./util');
import fs = require('fs');
import path = require('path');

/**
 * Sysroot are CXX toolchain system root
 * A sysroot is the minimal set of headers and libraries that are required to build something
 * Sysroot are put into the build system by the _CXXTarget target.
 * The target find the sysroot that matches the build environment and ask the sysroot to provide compile, link and archive tasks
 */
class Sysroot implements Sysroot.Interface {
  name: string;
  architectures: string[];
  /** Platform (ie. darwin, linux, win32, android, ios, ...) */
  platform: string;
  /** API (ie. darwin, linux, win32, mingw-w64, mingw, bsd, ios, ...) */
  api: string;
  /** API version (ie. 10.10, windows7, debian7, debian8, ...) */
  "api-version":string;

  constructor(public directory:string, extension:{}) {
    _.extend(this, extension);
  }

  /** List of loaded sysroot classes */
  static sysrootClasses: {[s: string]: typeof Sysroot} = {};
  static loadClasses(directory:string) {
    _.extend(Sysroot.sysrootClasses, util.requireDir(directory));
  }

  /** List of loaded sysroot */
  static sysroots: Sysroot[] = [];
  /** Search for 'sysroot.js' files in 'directory' sub directories and load them as sysroot. */
  static load(directory:string) {
    var dirnames = fs.readdirSync(directory);
    dirnames.forEach(function (dirname) {
      var filename = path.join(directory, dirname, "sysroot.js");
      if (fs.existsSync(filename)) {
        var extension = require(filename);
        var constructor: typeof Sysroot;
        constructor = extension.parent ? Sysroot.sysrootClasses[extension.parent]: Sysroot;
        var sysroot = new constructor(path.join(directory, dirname), extension);
        if (extension.init)
          extension.init.call(sysroot);
        Sysroot.sysroots.push(sysroot);
      }
    });
  }

  /**
   * Find the first sysroot that match the given environment
   * Matches occurs on the following keys:
   *  - arch
   *  - platform
   *  - sysroot-api
   *  - sysroot-api-version
   *  - sysroot-name
   * A least of the keys must match
   */
  static find(env:Workspace.Environment) : Sysroot {
    return Sysroot.sysroots.find(function (sysroot) {
      var tested = 0;
      if (env.arch && ++tested && !_.contains(sysroot.architectures, env.arch))
        return false;
      if (env.platform && ++tested && env.platform !== sysroot.platform)
        return false;
      if (env["sysroot-api"] && ++tested && env["sysroot-api"] !== sysroot.api)
        return false;
      if (env["sysroot-api-version"] && ++tested && env["sysroot-api-version"] !== sysroot["api-version"])
        return false;
      if (env["sysroot-name"] && ++tested && env["sysroot-name"] !== sysroot.name)
        return false;
      return tested > 0;
    });
  }

  createCompileTask(target: CXXTarget, srcFile: File, objFile: File, callback: Sysroot.CreateTaskCallback) {
    throw "Sysroot must reimplement this to work";
  }

  createLinkTask(target: CXXTarget, compileTasks: CompileTask[], finalFile: File, callback: Sysroot.CreateTaskCallback) {
    throw "Sysroot must reimplement this to work";
  }

  configure(target: CXXTarget, callback: ErrCallback) {
    callback();
  }

  linkFinalName(target: CXXTarget):string {
    if(target.isInstanceOf("Library") && !target.isInstanceOf("Bundle") && !target.isInstanceOf("Framework"))
      return "lib" + target.outputName;
    return target.outputName;
  }

  linkFinalPath(target: CXXTarget):string {
    var ret;
    if(target.isInstanceOf("Framework"))
      ret= path.join((<Framework>target).buildBundleContentsPath(), this.linkFinalName(target));
    else
      ret= path.join(target.output, this.linkFinalName(target));
    return ret;
  }
}

module Sysroot {
  export interface Interface {
    createCompileTask(target: CXXTarget, srcFile: File, objFile: File, callback: Sysroot.CreateTaskCallback);
    createLinkTask(target: CXXTarget, compileTasks: CompileTask[], finalFile: File, callback: Sysroot.CreateTaskCallback);
    configure(target: CXXTarget, callback: ErrCallback);
    linkFinalName(target: CXXTarget):string;
    linkFinalPath(target: CXXTarget):string;
  }
  export interface CreateTaskCallback {
    (err: Error, task?: Task);
  }
}
export = Sysroot;
