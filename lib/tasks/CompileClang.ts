/// <reference path="../../typings/tsd.d.ts" />
/* @flow weak */
import File = require('../core/File');
import Task = require('../core/Task');
import CompileTask = require('./Compile');

class CompileClangTask extends CompileTask {
  constructor(srcFile:File, objFile:File) {
    super(srcFile, objFile);
    this.bin = "clang";
    /*
    if (options.variant === "release")
      this.appendArgs("-O3");
    if (options.variant === "debug")
      this.appendArgs("-g")
    */
    if(!(<any>process.stdout).isTTY)
      this.appendArgs(['-fno-color-diagnostics']);
    this.appendArgs([
      "-c", srcFile.path,
      "-o", objFile.path
    ]);
  }
}
Task.registerClass(CompileClangTask, "CompileClang");

export = CompileClangTask;