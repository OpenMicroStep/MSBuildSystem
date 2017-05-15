import {File, Graph} from '@openmicrostep/msbuildsystem.core';
import {ProcessTask, ProcessProviderConditions} from '@openmicrostep/msbuildsystem.foundation';

export class CompileMasmTask extends ProcessTask {
  constructor(graph: Graph, srcFile:File, objFile:File, provider: ProcessProviderConditions = { assembler: "msvc" }) {
    super({ type: "compile", name: srcFile.name }, graph, [srcFile], [objFile], provider);

    this.appendArgs([
      "/Fo", [objFile],
      "/c", [srcFile]
    ]);
  }
}
