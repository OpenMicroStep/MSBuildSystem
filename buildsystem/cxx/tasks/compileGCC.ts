import {File, Task, declareTask, Graph, Provider, ProviderConditions, process, Step, Diagnostic} from '../../core';
import {CompileTask} from './compile';

@declareTask({ type: "cxxcompilegcc" })
export class CompileGCCTask extends CompileTask {
  constructor(graph: Graph, srcFile:File, objFile:File, provider: ProviderConditions = { compiler: "gcc" }) {
    super(graph, srcFile, objFile, provider);
    /*
    if(options.variant === "release")
      this.appendArgs("-O3");
    if(options.variant === "debug")
      this.appendArgs("-g");
    */
    this.appendArgs([
      "-o", [objFile],
      "-c", [srcFile]
    ]);
  }
}
