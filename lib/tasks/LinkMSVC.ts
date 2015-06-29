/// <reference path="../../typings/tsd.d.ts" />
/* @flow weak */
'use strict';

import CompileTask = require('./Compile');
import File = require('../core/File');
import Task = require('../core/Task');
import LinkTask = require('./Link');
import Graph = require('../core/Graph');
import Provider = require('../core/Provider');
import CXXTarget = require('../targets/_CXXTarget');
import path = require('path');

class LinkMSVCTask extends LinkTask {
  public dumpbinProvider : Provider.Process = null;
  public exports : File[] = [];
  constructor(graph: Graph, compileTasks: CompileTask[], finalFile: File, type: CXXTarget.LinkType) {
    super(graph, compileTasks, finalFile, type);
    if(this.type === CXXTarget.LinkType.STATIC) {
      this.appendArgs(["/out:" + finalFile.path]);
    }
    else {
      this.appendArgs(["kernel32.lib", "user32.lib", "shell32.lib", "MSVCRT.lib", "oldnames.lib"]);
      this.appendArgs(["/nologo"]);
      this.appendArgs(["/debug"]);
      if(this.type === CXXTarget.LinkType.DYNAMIC) {
        this.appendArgs(["/dll"]);
        var out = File.getShared(finalFile.path.substring(0, finalFile.path.length - 3) + "lib");
        this.exports.push(out);
        this.outputFiles.push(out);
      }
      this.outputFiles.push(File.getShared(finalFile.path.substring(0, finalFile.path.length - 3) + "pdb"));
      this.appendArgs(["/out:" + finalFile.path]);
    }
    this.appendArgs(this.inputFiles.map(function (file) {
      return file.path;
    }));
  }
  addFlags(libs: string[]) {
    this.insertArgs(2, libs);
  }

  runProcess(callback : (err: string, output: string) => any) {
    super.runProcess((err, output) => {
      if (err) return callback(err, output);
      if(false && this.type === CXXTarget.LinkType.DYNAMIC) {
        var args = ["/EXPORTS"];
        this.exports.forEach((file) => { args.push(file.path); });
        this.dumpbinProvider.process(this.exports, [], "runTask", {
          args: ["/EXPORTS", ],
        }, (err, exports) => {
          if (err) return callback(err, output);
          console.info(exports);
          callback(err, output);
        });
      }
      else {
        callback(err, output);
      }
    });
  }

  private _addLibFlags(libs: string[], isArchive: boolean) {
    if(this.type !== CXXTarget.LinkType.STATIC)
      this.addFlags(libs.map((lib) => {
        if (lib[0] == '-' && lib[1] == 'l')
          lib= lib.substring(2) + ".lib";
        if(path.extname(lib) == ".dll") {
          lib = lib.substring(0, lib.length - 3) + "lib";}
        if (path.isAbsolute(lib)) {
          var f = File.getShared(lib);
          if (isArchive)
            this.exports.push(f);
          this.inputFiles.push(f);
        }
        return lib;
      }));
  }
  addLibraryFlags(libs: string[]) {
    this._addLibFlags(libs, false);
  }

  addArchiveFlags(libs: string[]) {
    this._addLibFlags(libs, true);
  }
}
Task.registerClass(LinkMSVCTask, "LinkMSVC");

export = LinkMSVCTask;