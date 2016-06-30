import {File, Task, declareTask, Graph, Provider, ProviderConditions, process, Step, Diagnostic} from '../../core';
import {ProcessTask} from '../../foundation';
import {CompileTask} from './compile';
import {CXXLinkType} from '../cxxTarget';

@declareTask({ type: "cxxlink" })
export class LinkTask extends ProcessTask {
  type: CXXLinkType;
  constructor(graph: Graph, compileTasks:CompileTask[], finalFile:File, type: CXXLinkType, provider) {
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
