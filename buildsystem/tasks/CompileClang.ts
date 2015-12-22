/// <reference path="../../typings/tsd.d.ts" />
/* @flow weak */
'use strict';

import File = require('../core/File');
import Task = require('../core/Task');
import Graph = require('../core/Graph');
import Provider = require('../core/Provider');
import CompileTask = require('./Compile');
import Target = require('../core/Target');

class CompileClangTask extends CompileTask {
  constructor(graph: Graph, srcFile:File, objFile:File) {
    super(graph, srcFile, objFile);

    this.appendArgs([
      "-o", objFile.path,
      "-c", srcFile.path
    ]);
    // if ( ?.variant.debug )

    if ((<Target>graph).variant !== "release")
      this.appendArgs(["-g"]);
    else
      this.appendArgs(["-O3", "-g"]);
    //if (this.language === 'C' || this.language === 'OBJC')
    //  this.appendArgs(["-std=c11"]);
    //if(!(<any>process.stdout).isTTY)
    //  this.appendArgs(['-fno-color-diagnostics']);
  }
}
Task.registerClass(CompileClangTask, "CompileClang");

export = CompileClangTask;