import {Provider, ProviderOptions, Step, process as child_process} from '@msbuildsystem/core';
import * as os from 'os';

export var maxConcurrentTasks: number = os.cpus().length;
var nbTaskRunning: number = 0;
var waitingTasks: (() => void)[] = [];

/** The local provider limits the amount of work done locally */
export abstract class LocalProvider extends Provider {
  process(step: Step, options: ProviderOptions) {
    step.setFirstElements((step) => {
      nbTaskRunning--;
      if (waitingTasks.length > 0)
        waitingTasks.shift()!();
      step.continue();
    });
    if (nbTaskRunning < maxConcurrentTasks) {
      nbTaskRunning++;
      this.localprocess(step, options);
    }
    else {
      waitingTasks.push(() => {
        nbTaskRunning++;
        this.localprocess(step, options);
      });
    }
  }
  
  abstract localprocess(step: Step, options: ProviderOptions);
}

export class ProcessProvider extends Provider {
  constructor(public bin: string, conditions, public options?: any) {
    super(conditions);
  }
  map(path) {
    return path;
  }
  process(step: Step, options: ProviderOptions) {
    var env = options.env || {};
    var args = options.args || [];
    if (this.options && this.options.PATH) {
      env = options.env || {};
      env['PATH'] = this.options.PATH.join(";") + ";" + process.env.PATH;
    }
    if (this.options && this.options.args) {
      args.unshift.apply(args, this.options.args);
    }
    this.run(this.bin, args, env, (err, code, signal, out) => {
      if (err)
        step.error(err);
      else if (signal)
        step.diagnostic({ type: "error", msg: `process terminated with signal ${signal}` });
      else if (code !== 0)
        step.diagnostic({ type: "error", msg: `process terminated with exit code: ${code}` });
      if (out)
        step.log(out);
      step.continue();
    });
  }
  run(bin: string, args: string[], env: {[s:string]: string}, cb: (err: Error, code: number, signal: string, out: string) => void) {
    child_process.run(this.bin, args, env, cb);
  }
}