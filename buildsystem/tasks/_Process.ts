import Provider = require('../core/Provider');
import Process = require('../core/Process');
import Graph = require('../core/Graph');
import Task = require('../core/Task');
import Barrier = require('../core/Barrier');
import File = require('../core/File');
import Target = require('../core/Target');
import crypto = require('crypto');

type Arg = string | (string|File)[];

class ProcessTask extends Task {
  public args: Arg[] = [];
  public env: {[s:string]: string} = null;

  constructor(name: Task.Name, graph: Graph, public inputFiles: File[], public outputFiles: File[], public provider: Provider.Conditions) {
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
  setEnv(env:{[s:string]: string}) {
    this.env = env;
  }

  protected insertArgs(pos:number, args: Arg[]) {
    this.args.splice(pos, 0, ...args);
  }

  protected appendArgs(args: Arg[]) {
    this.args.push(...args);
  }

  protected prependArgs(args: Arg[]) {
    this.args.unshift(...args);
  }

  uniqueKey(): string {
    return this.flattenArgs().join(" ");
  }

  isRunRequired(step, callback: (err, required:boolean) => any) {
    if(this.inputFiles.length && this.outputFiles.length) {
      var barrier = new File.EnsureBarrier("Compile.isRunRequired", 2);
      File.ensure(step, this.inputFiles, {}, barrier.decCallback());
      File.ensure(step, this.outputFiles, {ensureDir: true}, barrier.decCallback());
      barrier.endWith(callback);
    }
    else {
      callback(null, true);
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
          out += provider ? provider.map((<File><any>a).path) : (<File><any>a).path;
      }
      return out;
    })
  }

  runProcess(step, provider: Provider) {
    step.setFirstElements((step) => {
      step.log(step.context.output);
      step.error(step.context.err);
      step.continue();
    });
    provider.process(step, this.inputFiles, this.outputFiles, "run", {
      args: this.flattenArgs(provider),
      env: this.env
    }, {
      requires: this.providerRequires(),
      task: this
    });
  }

  providerRequires() {
    return ["inputs", "outputs"];
  }

  run(step) {
    var provider = Provider.find(this.provider);
    if(!provider) {
      step.error("'provider' not found");
      step.continue();
    }
    else {
      this.runProcess(step, provider);
    }
  }

  do(step) {
    step.setFirstElements((p) => {
      step.sharedData.command = { provider: this.provider, args: this.flattenArgs() };
      p.continue();
    })
    super.do(step);
  }

  clean(step) {
    var errors = 0;
    var barrier = new Barrier("Clear process product", this.outputFiles.length);
    this.outputFiles.forEach((file) => {
      file.unlink((err) => {
        step.log("unlink " + file.path);
        if (err)
          step.error(err.toString());
        barrier.dec();
      })
    });
    barrier.endWith(() => {
      step.continue();
    });
  }

  listOutputFiles(set: Set<File>) {
    this.outputFiles.forEach((out) => { set.add(out); });
  }
}

export = ProcessTask;