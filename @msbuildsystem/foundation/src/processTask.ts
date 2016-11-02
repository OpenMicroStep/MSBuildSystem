import {Graph, Task, TaskName, Step, StepWithData, File, AttributePath, Barrier} from '@msbuildsystem/core';
import {ProcessProvider, ProcessProviderConditions, ProcessProviderRequirement, ProcessProviders} from './index';
import {Hash} from 'crypto';

/** if the argument is an array, the content the array will be concatenated */
export type Arg = string | (string|File)[];

export class ProcessTask extends Task {
  args: Arg[] = [];
  env?: {[s: string]: string} = undefined;
  cwd?: string = undefined;

  constructor(name: TaskName, graph: Graph, public inputFiles: File[], public outputFiles: File[], public provider: ProcessProviderConditions) {
    super(name, graph);
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

  isRunRequired(step: Step<{ runRequired?: boolean }>) {
    if (this.inputFiles.length && this.outputFiles.length) {
      // Force creation of output file directories
      File.ensure(this.outputFiles, step.context.lastSuccessTime, {ensureDir: true}, (err, required) => {
        if (err || required) {
          step.context.runRequired = true;
          step.continue();
        }
        else {
          File.ensure(this.inputFiles, step.context.lastSuccessTime, {}, (err, required) => {
            step.context.runRequired = !!(err || required);
            step.continue();
          });
        }
      });
    }
    else {
      step.context.runRequired = step.context.lastSuccessTime === 0;
      step.continue();
    }
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

  runProcess(step: Step<{ output?: string, err?: any }>, provider: ProcessProvider) {
    step.setFirstElements((step) => {
      step.context.reporter.log(step.context.output);
      step.context.reporter.error(step.context.err);
      step.continue();
    });
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

  clean(step: Step<{}>) {
    var barrier = new Barrier("Clear process product", this.outputFiles.length);
    this.outputFiles.forEach((file) => {
      file.unlink((err) => {
        step.context.reporter.log("unlink " + file.path + (err ? " failed" : "succeeded"));
        if (err)
          step.context.reporter.error(err);
        barrier.dec();
      });
    });
    barrier.endWith(() => {
      step.continue();
    });
  }

  listOutputFiles(set: Set<File>) {
    this.outputFiles.forEach((out) => { set.add(out); });
  }
}
