import {File, declareTask, Graph, ProviderConditions} from '@msbuildsystem/core';
import {ProcessTask} from '@msbuildsystem/foundation';

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
