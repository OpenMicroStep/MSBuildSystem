/// <reference path="../../typings/tsd.d.ts" />
/* @flow weak */
'use strict';

import ProcessTask = require('./_Process');
import LinkTask = require('./Link');
import Process = require('../core/Process');
import File = require('../core/File');
import Task = require('../core/Task');
import Graph = require('../core/Graph');

class LipoTask extends ProcessTask {
  constructor(graph: Graph, linkTasks: LinkTask[], finalFile: File) {
    var inputs = linkTasks.map(function (task) {
      return task.outputFiles[0];
    });
    super({ type: "link", name: finalFile.name }, graph, inputs, [finalFile], {linker:"lipo"});
    this.addDependencies(linkTasks);
    this.appendArgs(["-create"]);
    linkTasks.forEach((task) => {
      this.appendArgs([task.outputFiles[0].path]);
    });
    this.appendArgs(["-output", finalFile.path]);
  }
}
Task.registerClass(LipoTask, "Lipo");

export = LipoTask;
