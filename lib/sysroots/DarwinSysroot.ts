/// <reference path="../../typings/tsd.d.ts" />
/* @flow weak */
import CompileTask = require('../tasks/Compile');
import File = require('../core/File');
import Workspace = require('../core/Workspace');
import Sysroot = require('../core/Sysroot');
import CompileClangTask = require('../tasks/CompileClang');
import LinkLibToolTask = require('../tasks/LinkLibTool');
import CXXTarget = require('../targets/_CXXTarget');


class DarwinSysroot extends Sysroot {
  platform: string;
  api: string;
  constructor(directory:string, extension:{}) {
    super(directory, extension);
  }

  createCompileTask(target: CXXTarget, srcFile: File, objFile: File, callback: Sysroot.CreateTaskCallback) {
    var task = new CompileClangTask(srcFile, objFile);
    if(target.linkType === CXXTarget.LinkType.DYNAMIC)
      task.addFlags(["-fPIC"]);

    callback(null, task);
  }
  createLinkTask(target: CXXTarget, compileTasks: CompileTask[], finalFile: File, callback: Sysroot.CreateTaskCallback) {
    var task = new LinkLibToolTask(compileTasks, finalFile, target.linkType);
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