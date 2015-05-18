/// <reference path="../../typings/tsd.d.ts" />
/* @flow weak */
import CompileTask = require('../tasks/Compile');
import File = require('../core/File');
import Workspace = require('../core/Workspace');
import Sysroot = require('../core/Sysroot');
import CompileClangTask = require('../tasks/CompileClang');
import LinkLibToolTask = require('../tasks/LinkLibTool');


class DarwinSysroot extends Sysroot {
  platform: string;
  api: string;
  constructor(directory:string, extension:{}) {
    super(directory, extension);
  }

  createCompileTask(options, srcFile, objFile, callback) {
    var task = new CompileClangTask(srcFile, objFile, options);
    if(options.target.shared)
      task.appendArgs("-fPIC");

    callback(null, task);
  }
  createLinkTask(options: Workspace.BuildInfo, compileTasks: CompileTask[], finalFile: File, callback) {
    var task = new LinkLibToolTask(compileTasks, finalFile, options);
    callback(null, task);
  }
  linkFinalName(options) {
    var name = super.linkFinalName(options);
    switch(options.target.type) {
      case 'library':
        name = "lib" + name + (options.target.shared ? ".dylib" : ".a");
        break;
    }
    return name;
  }
  configure(options, callback) {
    options.env.linker = options.env.linker || "libtool";
    options.env.compiler = options.env.compiler || "clang";
    if(options.env.compiler !== "clang")
      return callback(new Error("darwin sysroot only supports clang compiler"));
    if(options.env.linker !== "libtool")
      return callback(new Error("darwin sysroot only supports libtool linker"));
    callback();
  }
}

DarwinSysroot.prototype.platform = "darwin";
DarwinSysroot.prototype.api = "darwin";

export = DarwinSysroot;