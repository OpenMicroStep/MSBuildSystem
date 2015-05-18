/// <reference path="../../typings/tsd.d.ts" />
/* @flow weak */
import ProcessTask = require('./_Process');
import LinkTask = require('./Link');
import Process = require('../core/Process');
import File = require('../core/File');

class LipoTask extends ProcessTask {
  constructor(linkTasks: LinkTask[], finalFile: File) {
    var inputs = linkTasks.map(function (task) {
      return task.outputFiles[0];
    });
    super("Lipo to " + finalFile.path, inputs, [finalFile]);
    this.addDependencies(linkTasks);
    this.appendArgs("-create");
    linkTasks.forEach((task) => {
      this.appendArgs(task.outputFiles[0].path);
    });
    this.appendArgs("-output", finalFile.path);
  }
}

export = LipoTask;
