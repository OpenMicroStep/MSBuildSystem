/// <reference path="../../typings/tsd.d.ts" />

/* @flow weak */
'use strict';

import Task = require('../core/Task');
import File = require('../core/File');
import Graph = require('../core/Graph');
import CompileTask = require('./Compile');

class CompileGCCTask extends CompileTask {
  constructor(graph: Graph, srcFile:File, objFile:File) {
    super(graph, srcFile, objFile);
    /*
    if(options.variant === "release")
      this.appendArgs("-O3");
    if(options.variant === "debug")
      this.appendArgs("-g");
    */
    this.appendArgs([
      "-o", objFile.path,
      "-c", srcFile.path
    ]);
  }
}
Task.registerClass(CompileGCCTask, "CompileGCC");

export = CompileGCCTask;