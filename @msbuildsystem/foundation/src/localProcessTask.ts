import {Graph, Step, StepWithData, Target, Task, AttributeTypes, ComponentElement} from '@openmicrostep/msbuildsystem.core';
import {safeSpawnProcess} from './index';

let v = AttributeTypes.defaultsTo(ComponentElement.objectValidator({}, AttributeTypes.validateString), undefined);
@Task.declare(["cmd"], {
  cmd: AttributeTypes.validateStringList,
  env: v,
  cwd: AttributeTypes.defaultsTo(AttributeTypes.validateString, (t: Target) => t.paths.output, 'target output'),
})
export class LocalProcessTask extends Task {
  cmd: string[] = [];
  env: {[s: string]: string} | undefined = undefined;
  cwd: string;

  constructor(name: string, graph: Graph, { cmd, env, cwd }: {
    cmd: string[]
    env: {[s: string]: string} | undefined;
    cwd: string;
  }) {
    super({ type: 'cmd', name: name }, graph);
    this.cmd = cmd;
    this.env = env;
    this.cwd = cwd;
  }

  uniqueKey() {
    return {
      cmd: this.cmd,
      env: this.env,
      cwd: this.cwd,
    };
  }

  do(step: StepWithData<{}, {}, { command: { args: string[] } }>) {
    step.context.sharedData.command = { args: this.cmd };
    super.do(step);
  }

  do_build(step: Step<{}>) {
    safeSpawnProcess(this.cmd[0], this.cmd.slice(1), this.cwd, this.env, (err, code, signal, out) => {
      if (err)
        step.context.reporter.error(err);
      if (out || signal || code !== 0) {
        step.context.reporter.log(`${this.cmd.map(a => /\s/.test(a) ? `"${a}"` : a).join(' ')}\n`);
        if (out)
          step.context.reporter.log(out);
        if (signal)
          step.context.reporter.log(`process terminated with signal ${signal}`);
        if (code !== 0)
          step.context.reporter.log(`process terminated with exit code: ${code}`);
      }
      step.continue();
    });
  }
}
