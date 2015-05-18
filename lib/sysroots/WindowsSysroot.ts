/// <reference path="../../typings/tsd.d.ts" />
/* @flow weak */
import Sysroot = require('../core/Sysroot');
import CompileClangTask = require('../tasks/CompileClang');
import LinkBinUtilsTask = require('../tasks/LinkBinUtils');

class WindowsSysroot extends Sysroot {
  constructor(directory:string, extension:{}) {
    super(directory, extension);
  }

  createCompileTask(options, srcFile, objFile, callback) {
    var task = new CompileClangTask(srcFile, objFile, options);
    callback(null, task);
  }
  createLinkTask(options, objFiles, finalFile, callback) {
    if(options.env.linker && options.env.linker !== "binutils")
      return callback(new Error("linux sysroot only supports binutils linker"));

    var task = new LinkBinUtilsTask(objFiles, finalFile, options);
    if(options.target.shared)
      task.appendArgs(["-shared"]);
    callback(null, task);
  }
  linkFinalName(options) {
    var name = options.target.name;
    switch(options.target.type) {
      case 'library':
        name = "lib" + name + (options.target.shared ? ".dll" : ".a");
        break;
      case 'framework':
        name = name + ".dll";
        break;
      case 'executable':
        name = name + ".exe";
        break;
    }
    return name;
  }
  configure(options, callback) {
    options.env.linker = options.env.linker || "binutils";
    options.env.compiler = options.env.compiler || "clang";
    if(options.env.compiler !== "clang")
      return callback(new Error("windows sysroot only supports clang compiler for now"));
    if(options.env.linker !== "libtool")
      return callback(new Error("windows sysroot only supports libtool linker"));
    callback();
  }
}

WindowsSysroot.prototype.platform = "win32";

export = WindowsSysroot;
