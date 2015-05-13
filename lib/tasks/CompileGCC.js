/* @flow weak */
var CompileTask = require('./Compile');
var util = require('util');

function CompileGCCTask(srcFile, objFile, options) {
  CompileTask.apply(this, arguments);
  if(options.variant === "release")
    this.appendArgs("-O3");
  if(options.variant === "debug")
    this.appendArgs("-g");
  this.appendArgs("-c", srcFile.path);
  this.appendArgs("-o", objFile.path);
}

util.inherits(CompileGCCTask, CompileTask);

module.exports = CompileGCCTask;