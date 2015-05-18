/// <reference path="../../typings/tsd.d.ts" />
/* @flow weak */
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
class Sysroot {
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

  createCompileTask(options: Workspace.BuildInfo, srcFile: File, objFile: File, callback: Sysroot.CreateTaskCallback) {
    throw "Sysroot must reimplement this to work";
  }

  createLinkTask(options: Workspace.BuildInfo, compileTasks: CompileTask[], finalFile: File, callback: Sysroot.CreateTaskCallback) {
    throw "Sysroot must reimplement this to work";
  }

  configure(options, callback) {
    callback();
  }

  linkFinalName(options):string {
    return options.target.outputName;
  }

  linkFinalPath(options):string {
    var ret;
    if(options.target.type === "framework")
      ret= path.join(options.targetOutput, options.target.outputName + ".framework", this.linkFinalName(options));
    else
      ret= path.join(options.targetOutput, this.linkFinalName(options));
    return ret;
  }
}

module Sysroot {
  export interface CreateTaskCallback {
    (err: Error, task?: Task);
  }
}
export = Sysroot;
