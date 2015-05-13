/* @flow weak */
var Sysroot = require('../core/Sysroot');
var CompileClangTask = require('../tasks/CompileClang');
var LinkLibToolTask = require('../tasks/LinkLibTool');
var util = require('util');

function DarwinSysroot()
{
  Sysroot.apply(this, arguments);
}

util.inherits(DarwinSysroot, Sysroot);

DarwinSysroot.prototype.platform = "darwin";
DarwinSysroot.prototype.api = "darwin";

DarwinSysroot.prototype.createCompileTask = function(options, srcFile, objFile, callback) {
  var task = new CompileClangTask(srcFile, objFile, options);
  if(options.target.shared)
    task.appendArgs("-fPIC");

  callback(null, task);
};

DarwinSysroot.prototype.createLinkTask = function(options, objFiles, finalFile, callback) {
  var task = new LinkLibToolTask(objFiles, finalFile, options);
  callback(null, task);
};

DarwinSysroot.prototype.linkFinalName = function(options) {
  var name = options.target.name;
  switch(options.target.type) {
    case 'library':
      name = "lib" + name + (this.shared ? ".dylib" : ".a");
      break;
  }
  return name;
};

DarwinSysroot.prototype.configure = function(options, callback) {
  options.env.linker = options.env.linker || "libtool";
  options.env.compiler = options.env.compiler || "clang";
  if(options.env.compiler !== "clang")
    return callback(new Error("darwin sysroot only supports clang compiler"));
  if(options.env.linker !== "libtool")
    return callback(new Error("darwin sysroot only supports libtool linker"));
  callback();
};

module.exports = DarwinSysroot;