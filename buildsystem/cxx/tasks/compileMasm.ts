import {File, Task, declareTask, Graph, Provider, ProviderConditions, process, Step, Diagnostic} from '../../core';
import {ProcessTask} from '../../foundation';

@declareTask({ type: "cxxcompilemasm" })
export class CompileMasmTask extends ProcessTask {
  constructor(graph: Graph, srcFile:File, objFile:File, provider: ProviderConditions = { assembler: "msvc" }) {
    super({ type: "compile", name: srcFile.name }, graph, [srcFile], [objFile], provider);

    this.appendArgs([
      "/Fo", [objFile],
      "/c", [srcFile]
    ]);
  }
}
