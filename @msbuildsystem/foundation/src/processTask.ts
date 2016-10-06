import {Graph, Task, TaskName, Step, File, Provider, ProviderConditions, ProviderRequirement, Barrier} from '@msbuildsystem/core';
import {Hash} from 'crypto';

/** if the argument is an array, the content the array will be concatenated */
export type Arg = string | (string|File)[];

export class ProcessTask extends Task {
  public args: Arg[] = [];
  public env?: {[s: string]: string} = undefined;

  constructor(name: TaskName, graph: Graph, public inputFiles: File[], public outputFiles: File[], public provider: ProviderConditions) {
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

  isRunRequired(step: Step) {
    step.context.runRequired = true;
    if (this.inputFiles.length && this.outputFiles.length) {
      // Force creation of output file directories
      File.ensure(this.outputFiles, step.lastSuccessTime, {ensureDir: true}, (err, required) => {
        if (err || required) {
          step.context.runRequired = true;
          step.continue();
        }
        else {
          File.ensure(this.inputFiles, step.lastSuccessTime, {}, (err, required) => {
            step.context.runRequired = !!(err || required);
            step.continue();
          });
        }
      });
    }
    else {
      step.continue();
    }
  }

  flattenArgs(provider?: Provider, args?: Arg[]) : string[] {
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

  do(step) {
    step.sharedData.command = { provider: this.provider, args: this.flattenArgs() };
    super.do(step);
  }

  run(step: Step) {
    var provider = Provider.find(this.provider);
    if (!provider) {
      step.diagnostic({
        type: "error",
        msg: "unable to find provider"
      });
      step.continue();
    }
    else {
      this.runProcess(step, provider);
    }
  }

  runProcess(step: Step, provider: Provider) {
    step.setFirstElements((step) => {
      step.log(step.context.output);
      step.error(step.context.err);
      step.continue();
    });
    provider.process(step, {
      action: "run",
      args: this.flattenArgs(provider),
      env: this.env,
      requirements: this.providerRequirements(),
      inputs: this.inputFiles,
      outputs: this.outputFiles,
      task: this
    });
  }

  providerRequirements() : ProviderRequirement[] {
    return ["inputs", "outputs"];
  }

  clean(step: Step) {
    var barrier = new Barrier("Clear process product", this.outputFiles.length);
    this.outputFiles.forEach((file) => {
      file.unlink((err) => {
        step.log("unlink " + file.path + (err ? " failed" : "succeeded"));
        if (err)
          step.error(err);
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
