import {Graph, TaskName, Step, StepWithData, File, AttributePath, InOutTask} from '@msbuildsystem/core';
import {ProcessProvider, ProcessProviderConditions, ProcessProviderRequirement, ProcessProviders} from './index';
import {Hash} from 'crypto';

/** if the argument is an array, the content the array will be concatenated */
export type Arg = string | (string|File)[];

export class ProcessTask extends InOutTask {
  args: Arg[] = [];
  env?: {[s: string]: string} = undefined;
  cwd: string;

  constructor(name: TaskName, graph: Graph, inputFiles: File[], outputFiles: File[], public provider: ProcessProviderConditions) {
    super(name, graph, inputFiles, outputFiles);
    this.cwd = graph.target().paths.output;
  }

  addOptions(options: any) {
  }

  addFlags(flags: Arg[]) {
    this.appendArgs(flags);
  }
  addFlagsAtEnd(flags: Arg[]) {
    this.appendArgs(flags);
  }
  setEnv(env: {[s: string]: string}) {
    this.env = env;
  }
  setCwd(cwd: string) {
    this.cwd = cwd;
  }

  protected insertArgs(pos: number, args: Arg[]) {
    this.args.splice(pos, 0, ...args);
  }

  protected appendArgs(args: Arg[]) {
    this.args.push(...args);
  }

  protected prependArgs(args: Arg[]) {
    this.args.unshift(...args);
  }

  uniqueKey(hash: Hash) {
    var args = this.flattenArgs();
    for (var i = 0, len = args.length; i < len; i++) {
      hash.update(args[i]);
      hash.update(" ");
    }
    return true;
  }

  flattenArgs(provider?: ProcessProvider, args?: Arg[]) : string[] {
    return (args || this.args).map((arg) => {
      if (typeof arg === "string")
        return arg;
      var out = "";
      for (var i = 0, l = arg.length; i < l; i++) {
        var a = arg[i];
        if (typeof a === "string")
          out += a;
        else
          out += provider ? provider.map(a.path) : a.path;
      }
      return out;
    });
  }

  do(step: StepWithData<{}, {}, { command: { provider: any, args: string[] } }>) {
    step.context.sharedData.command = { provider: this.provider, args: this.flattenArgs() };
    super.do(step);
  }

  run(step: Step<{}>) {
    var provider = ProcessProviders.validate(step.context.reporter, new AttributePath(this.target()), this.provider);
    if (!provider) {
      step.continue();
    }
    else {
      this.runProcess(step, provider);
    }
  }

  runProcess(step: Step<{}>, provider: ProcessProvider) {
    provider.process(step, {
      action: "run",
      arguments: this.flattenArgs(provider),
      env: this.env,
      cwd: this.cwd,
      requirements: this.providerRequirements(),
      inputs: this.inputFiles,
      outputs: this.outputFiles
    });
  }

  providerRequirements() : ProcessProviderRequirement[] {
    return [ProcessProviderRequirement.Inputs, ProcessProviderRequirement.Outputs];
  }
}
