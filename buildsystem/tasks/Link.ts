import ProcessTask = require('./_Process');
import File = require('../core/File');
import Task = require('../core/Task');
import Graph = require('../core/Graph');
import CXXTarget = require('../targets/_CXXTarget');
import CompileTask = require('./Compile');
var util = require('util');


class LinkTask extends ProcessTask {
  type: CXXTarget.LinkType;
  constructor(graph: Graph, compileTasks:CompileTask[], finalFile:File, type: CXXTarget.LinkType, provider) {
    var outputs = compileTasks.map(function (task: CompileTask) {
      return task.outputFiles[0];
    });
    super({ type: "link", name: finalFile.name }, graph, outputs, [finalFile], provider);
    this.addDependencies(compileTasks);
    this.type = type;
  }

  addLibraryFlags(libs: string[]) {
    this.addFlags(libs);
  }

  addArchiveFlags(libs: string[]) {
    this.addLibraryFlags(libs);
  }
}
Task.registerClass(LinkTask, "Link");
export = LinkTask;