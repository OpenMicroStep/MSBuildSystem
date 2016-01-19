import File = require('../core/File');
import Task = require('../core/Task');
import Graph = require('../core/Graph');
import Provider = require('../core/Provider');
import ProcessTask = require('./_Process');

class CompileMasmTask extends ProcessTask {
  constructor(graph: Graph, srcFile:File, objFile:File, provider: Provider.Conditions = { assembler: "msvc" }) {
    super({ type: "compile", name: srcFile.name }, graph, [srcFile], [objFile], provider);

    this.appendArgs([
      "/Fo", objFile.path,
      "/c", srcFile.path
    ]);
  }
}
Task.registerClass(CompileMasmTask, "CompileMasm");

export = CompileMasmTask;