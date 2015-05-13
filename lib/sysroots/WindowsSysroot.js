/* @flow weak */
var Sysroot = require('../core/Sysroot');
var ClangCompileTask = require('../tasks/CompileClang');
var LinkBinUtilsTask = require('../tasks/LinkBinUtils');
var util = require('util');

function WindowsSysroot()
{
  Sysroot.apply(this, arguments);
}

util.inherits(WindowsSysroot, Sysroot);

WindowsSysroot.prototype.platform = "win32";

WindowsSysroot.prototype.createCompileTask = function(options, srcFile, objFile, callback) {
  var task = new ClangCompileTask(srcFile, objFile, options);
  callback(null, task);
};

WindowsSysroot.prototype.createLinkTask = function(options, objFiles, finalFile, callback) {
  if(options.env.linker && options.env.linker !== "binutils")
    return callback(new Error("windows sysroot only supports binutils linker"));

  var task = new LinkBinUtilsTask(objFiles, finalFile, options);
  if(options.target.shared)
    task.appendArgs("-shared");
  callback(null, task);
};

module.exports = WindowsSysroot;