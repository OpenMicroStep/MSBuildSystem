import Task = require('../core/Task');
import File = require('../core/File');
import Graph = require('../core/Graph');
import Provider = require('../core/Provider');
import CompileTask = require('./Compile');

class CompileGCCTask extends CompileTask {
  constructor(graph: Graph, srcFile:File, objFile:File, provider: Provider.Conditions = { compiler: "gcc" }) {
    super(graph, srcFile, objFile, provider);
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