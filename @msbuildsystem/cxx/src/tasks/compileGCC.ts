import {File, declareTask, Graph} from '@msbuildsystem/core';
import {ProcessProviderConditions} from '@msbuildsystem/foundation';
import {CompileTask} from '../index.priv';

@declareTask({ type: "cxxcompilegcc" })
export class CompileGCCTask extends CompileTask {
  constructor(graph: Graph, srcFile:File, objFile:File, provider: ProcessProviderConditions = { compiler: "gcc" }) {
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
