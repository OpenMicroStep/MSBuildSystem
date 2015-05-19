/// <reference path="../../typings/tsd.d.ts" />
/* @flow weak */
import Task = require('../core/Task');
import File = require('../core/File');
import CompileTask = require('./Compile');

class CompileGCCTask extends CompileTask {
  constructor(srcFile:File, objFile:File) {
    super(srcFile, objFile);
    /*
    if(options.variant === "release")
      this.appendArgs("-O3");
    if(options.variant === "debug")
      this.appendArgs("-g");
    */
    this.appendArgs([
      "-c", srcFile.path,
      "-o", objFile.path
    ]);
  }
}
Task.registerClass(CompileGCCTask, "CompileGCC");

export = CompileGCCTask;