import {CXXTarget} from './cxxTarget';
import {Framework} from './targets/framework';
import {Task, Workspace, Provider, File, util} from '../core';
import {CompileTask} from './tasks/compile';
import * as _ from 'underscore';
import * as fs from 'fs';
import * as path from 'path';

/**
 * A sysroot is a CXX compilation toolchain kit that target a specific platform api and architecture
 */
export class CXXSysroot implements Interface {
  name: string;
  /** Architecture (ie. i386, x86_64, armv7, ...) */
  architecture: string;
  /** Platform (ie. darwin, linux, win32, android, ios, ...) */
  platform: string;
  /** API (ie. darwin, linux, win32, mingw-w64, mingw, bsd, ios, ...) */
  api: string;
  /** API version (ie. 10.10, windows7, debian7, debian8, ...) */
  apiVersion:string;

  constructor(public directory:string, extension:{}) {
    console.info("sysroot", directory, extension);
    _.extend(this, extension);
    var providers = extension["provides"];
    if (Array.isArray(providers)) {
      providers.forEach((providerInfo) => {
        if (typeof providerInfo.process === "string") {
          var bin = providerInfo.process;
          delete providerInfo.process;
          var provider = new Provider.Process(path.join(this.directory, bin), providerInfo);
          Provider.register(provider);
        }
      });
    }
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
      if (env.sysroot && ++tested && env.sysroot !== sysroot.api)
        return false;
      if (env.sysrootVersion && ++tested && env.sysrootVersion !== sysroot["api-version"])
        return false;
      if (env["sysroot-name"] && ++tested && env["sysroot-name"] !== sysroot.name)
        return false;
      return tested > 0;
    });
  }

  createCompileTask(target: CXXTarget, srcFile: File, objFile: File, callback: CreateTaskCallback) {
    throw "Sysroot must reimplement this to work";
  }

  createLinkTask(target: CXXTarget, compileTasks: CompileTask[], finalFile: File, callback: CreateTaskCallback) {
    throw "Sysroot must reimplement this to work";
  }

  configure(target: CXXTarget, callback: ErrCallback) {
    callback();
  }

  linkFinalName(target: CXXTarget):string {
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

export interface Interface {
  createCompileTask(target: CXXTarget, srcFile: File, objFile: File, callback: CreateTaskCallback);
  createLinkTask(target: CXXTarget, compileTasks: CompileTask[], finalFile: File, callback: CreateTaskCallback);
  configure(target: CXXTarget, callback: ErrCallback);
  linkFinalName(target: CXXTarget):string;
  linkFinalPath(target: CXXTarget):string;
}
export interface CreateTaskCallback {
  (err: Error, task?: Task);
}

