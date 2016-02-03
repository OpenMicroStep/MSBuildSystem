import Provider = require('../core/Provider');
import Process = require('../core/Process');
import Graph = require('../core/Graph');
import Task = require('../core/Task');
import Barrier = require('../core/Barrier');
import File = require('../core/File');
import Target = require('../core/Target');
import crypto = require('crypto');

class ProcessTask extends Task {
  public args: string[] = [];
  public env: {[s:string]: string} = null;

  constructor(name: Task.Name, graph: Graph, public inputFiles: File[], public outputFiles: File[], public provider: Provider.Conditions) {
    super(name, graph);
  }

  addFlags(flags: string[]) {
    this.appendArgs(flags);
  }
  addFlagsAtEnd(flags: string[]) {
    this.appendArgs(flags);
  }
  setEnv(env:{[s:string]: string}) {
    this.env = env;
  }

  protected insertArgs(pos:number, args: string[]) {
    this.args.splice(pos, 0, ...args);
  }

  protected appendArgs(args: string[]) {
    this.args.push(...args);
  }

  protected prependArgs(args: string[]) {
    this.args.unshift(...args);
  }

  uniqueKey(): string {
    return this.args.join(" ");
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

  runProcess(step, provider: Provider) {
    step.setFirstElements((step) => {
      step.log(step.context.output);
      step.error(step.context.err);
      step.continue();
    });
    provider.process(step, this.inputFiles, this.outputFiles, "run", {
      args: this.args,
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
      step.sharedData.command = { provider: this.provider, args: this.args };
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