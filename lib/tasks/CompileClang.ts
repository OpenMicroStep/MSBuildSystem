/// <reference path="../../typings/tsd.d.ts" />
/* @flow weak */
'use strict';

import File = require('../core/File');
import Task = require('../core/Task');
import Graph = require('../core/Graph');
import CompileTask = require('./Compile');

class CompileClangTask extends CompileTask {
  constructor(graph: Graph, srcFile:File, objFile:File) {
    super(graph, srcFile, objFile);
    this.bin = "clang";

    /*if (options.variant === "debug")
      this.appendArgs("-g")
    */
    this.appendArgs([
      "-o", objFile.path,
      "-c", srcFile.path
    ]);
    this.appendArgs(["-g"]);
    if (this.language === 'C' || this.language === 'OBJC')
      this.appendArgs(["-std=gnu11"]);
    //this.appendArgs(["-O3"]);
    //if(!(<any>process.stdout).isTTY)
    //  this.appendArgs(['-fno-color-diagnostics']);
  }
}
Task.registerClass(CompileClangTask, "CompileClang");

export = CompileClangTask;