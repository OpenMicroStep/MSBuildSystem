/// <reference path="../../typings/tsd.d.ts" />
/* @flow weak */
import ProcessTask = require('./_Process');
import File = require('../core/File');
import CompileTask = require('./Compile');
var util = require('util');

class LinkTask extends ProcessTask {
  constructor(compileTasks:CompileTask[], finalFile:File) {
    var outputs = compileTasks.map(function (task: CompileTask) {
      return task.outputFiles[0];
    });
    super("Link to " + finalFile.name, outputs, [finalFile]);
    this.addDependencies(compileTasks);
  }
}

export = LinkTask;