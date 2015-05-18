/// <reference path="../../typings/tsd.d.ts" />
/* @flow weak */
import File = require('../core/File');
import CompileTask = require('./Compile');

class CompileGCCTask extends CompileTask {
  constructor(srcFile:File, objFile:File, options) {
    super(srcFile, objFile);
    if(options.variant === "release")
      this.appendArgs("-O3");
    if(options.variant === "debug")
      this.appendArgs("-g");
    this.appendArgs("-c", srcFile.path);
    this.appendArgs("-o", objFile.path);
  }
}

export = CompileGCCTask;