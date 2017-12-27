import {
  File, Directory,
  Task, Graph, Target, InOutTask, Step,
  Reporter, AttributeTypes as V, PathReporter,
  FileElement, ComponentElement} from '@openmicrostep/msbuildsystem.core';
import {ResourceCompilerProviders} from '../index.priv';

export type CompileResourceAttributes = {
  rcFile: File,
  resFile: File,
  compiler: string,
}

@Task.declare(["cxx-link"], {
  rcFile: FileElement.validateFile,
  resFile: FileElement.validateFile,
  compiler: V.defaultsTo(V.validateString, ''),
})
export class CompileResourceTask extends InOutTask {
  constructor(name: string, graph: Graph, public attributes: CompileResourceAttributes) {
    super({type: "cxx-rc", name: name}, graph, [attributes.rcFile], [attributes.resFile]);
  }

  do_build(step: Step) {
    let provider = ResourceCompilerProviders.validateBest.validate(new PathReporter(step.context.reporter), this.attributes.compiler);
    if (!provider) return step.continue();
    provider.do_compile_resource(step, this.attributes);
  }
}
