import {Graph, Step, StepWithData, Target, Task, AttributeTypes, ComponentElement} from '@openmicrostep/msbuildsystem.core';
import {safeSpawnProcess} from './index';

let v = AttributeTypes.defaultsTo(ComponentElement.objectValidator({}, AttributeTypes.validateString), undefined);
@Task.declare(["cmd"], {
  cmd: AttributeTypes.validateStringList,
  env: v,
  cwd: AttributeTypes.defaultsTo(AttributeTypes.validateString, (t: Target) => t.paths.output, 'target output'),
  tty: AttributeTypes.defaultsTo(AttributeTypes.validateBoolean, false),
})
export class LocalProcessTask extends Task {
  constructor(name: string, graph: Graph, public params: {
    cmd: string[]
    env: {[s: string]: string} | undefined;
    cwd: string;
    tty: boolean;
  }) {
    super({ type: 'cmd', name: name }, graph);
  }

  uniqueKey() {
    return this.params;
  }

  do(step: StepWithData<{}, {}, { command: { args: string[] } }>) {
    step.context.sharedData.command = { args: this.params.cmd };
    super.do(step);
  }

  do_build(step: Step<{}>) {
    safeSpawnProcess(step, this.params);
  }
}
