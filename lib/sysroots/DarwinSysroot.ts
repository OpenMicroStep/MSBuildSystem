/// <reference path="../../typings/tsd.d.ts" />
/* @flow weak */
'use strict';

import CompileTask = require('../tasks/Compile');
import File = require('../core/File');
import Workspace = require('../core/Workspace');
import Sysroot = require('../core/Sysroot');
import Provider = require('../core/Provider');
import CompileClangTask = require('../tasks/CompileClang');
import LinkLibToolTask = require('../tasks/LinkLibTool');
import CXXTarget = require('../targets/_CXXTarget');


class DarwinSysroot extends Sysroot {
  platform: string;
  api: string;
  triples;
  constructor(directory:string, extension:{}) {
    super(directory, extension);
  }

  createCompileTask(target: CXXTarget, srcFile: File, objFile: File, callback: Sysroot.CreateTaskCallback) {
    var task = new CompileClangTask(target, srcFile, objFile);
    task.provider= <Provider.Process>Provider.find({compiler:"clang"});
    if(target.linkType !== CXXTarget.LinkType.EXECUTABLE)
      task.addFlags(["-fPIC"]);
    if (this.triples)
      task.addFlags(["--target=" + this.triples[target.arch]]);
    callback(null, task);
  }
  createLinkTask(target: CXXTarget, compileTasks: CompileTask[], finalFile: File, callback: Sysroot.CreateTaskCallback) {
    var task = new LinkLibToolTask(target, compileTasks, finalFile, target.linkType);
    switch (target.linkType) {
      case CXXTarget.LinkType.DYNAMIC: task.provider= <Provider.Process>Provider.find({compiler:"clang"}); break;
      case CXXTarget.LinkType.EXECUTABLE: task.provider= <Provider.Process>Provider.find({compiler:"clang"}); break;
      case CXXTarget.LinkType.STATIC: task.provider= <Provider.Process>Provider.find({linker:"libtool"}); break;
      default: return callback(new Error("Unknown target.linkType"));
    }
    if(target.linkType === CXXTarget.LinkType.DYNAMIC)
      task.addFlags(["-fPIC"]);
    if (this.triples && target.linkType !== CXXTarget.LinkType.STATIC)
      task.addFlags(["--target=" + this.triples[target.arch]]);
    callback(null, task);
  }
  linkFinalName(target: CXXTarget):string {
    var name = super.linkFinalName(target);
    if(target.isInstanceOf("Library") && !target.isInstanceOf("Bundle") && !target.isInstanceOf("Framework"))
        name += (target.linkType === CXXTarget.LinkType.DYNAMIC ? ".dylib" : ".a");
    return name;
  }
  configure(target: CXXTarget, callback: ErrCallback) {
    target.env.linker = target.env.linker || "libtool";
    target.env.compiler = target.env.compiler || "clang";
    if(target.env.compiler !== "clang")
      return callback(new Error("darwin sysroot only supports clang compiler"));
    if(target.env.linker !== "libtool")
      return callback(new Error("darwin sysroot only supports libtool linker"));
    callback();
  }
}

DarwinSysroot.prototype.platform = "darwin";
DarwinSysroot.prototype.api = "darwin";

export = DarwinSysroot;