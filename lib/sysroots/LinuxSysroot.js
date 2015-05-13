/* @flow weak */
var Sysroot = require('../core/Sysroot');
var ClangCompileTask = require('../tasks/CompileClang');
var LinkBinUtilsTask = require('../tasks/LinkBinUtils');
var util = require('util');

function LinuxSysroot()
{
  Sysroot.apply(this, arguments);
}

util.inherits(LinuxSysroot, Sysroot);

LinuxSysroot.prototype.platform = "linux";

LinuxSysroot.prototype.createCompileTask = function(options, srcFile, objFile, callback) {
  var task = new ClangCompileTask(srcFile, objFile, options);
  if(options.target.shared)
    task.appendArgs("-fPIC");
  callback(null, task);
};

LinuxSysroot.prototype.createLinkTask = function(options, objFiles, finalFile, callback) {
  if(options.env.linker && options.env.linker !== "binutils")
    return callback(new Error("linux sysroot only supports binutils linker"));

  var task = new LinkBinUtilsTask(objFiles, finalFile, options);
  if(options.target.shared)
    task.addFlags(["-rdynamic"]);
  callback(null, task);
};

module.exports = LinuxSysroot;