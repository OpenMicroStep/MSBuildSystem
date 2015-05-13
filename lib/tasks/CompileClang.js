/* @flow weak */
var CompileTask = require('./Compile');
var util = require('util');

function CompileClangTask(srcFile, objFile, options) {
  CompileTask.apply(this, arguments);

  if(options.variant === "release")
    this.appendArgs("-O3");
  if(options.variant === "debug")
    this.appendArgs("-g");
  this.appendArgs('-fno-color-diagnostics');
  this.appendArgs("-c", srcFile.path);
  this.appendArgs("-o", objFile.path);
}

util.inherits(CompileClangTask, CompileTask);

module.exports = CompileClangTask;