import {Step} from '@openmicrostep/msbuildsystem.core';
import {ProcessProvider, ProcessProviderOptions} from './index';
import * as child_process from 'child_process';

export class LocalProcessProvider extends ProcessProvider {
  constructor(public bin: string, conditions, public options?: any) {
    super(conditions);
  }
  map(path) {
    return path;
  }
  process(step: Step<{}>, options: ProcessProviderOptions) {
    var env = options.env || {};
    var args = options.arguments || [];
    if (this.options && this.options.PATH) {
      env = options.env || {};
      env['PATH'] = this.options.PATH.join(";") + ";" + process.env.PATH;
    }
    if (this.options && this.options.args) {
      args.unshift.apply(args, this.options.args);
    }
    this.run(this.bin, args, options.cwd, env, (err, code, signal, out) => {
      if (err)
        step.context.reporter.error(err);
      else if (signal)
        step.context.reporter.diagnostic({ type: "error", msg: `process terminated with signal ${signal}` });
      else if (code !== 0)
        step.context.reporter.diagnostic({ type: "error", msg: `process terminated with exit code: ${code}` });
      if (out) {
        step.context.reporter.log(`${this.bin} ${args.map(a => /\s/.test(a) ? `"${a}"` : a).join(' ')}\n`);
        step.context.reporter.log(out);
      }
      step.continue();
    });
  }
  run(bin: string, args: string[], cwd: string | undefined, env: {[s: string]: string}, cb: (err: Error, code: number, signal: string, out: string) => void) {
    safeSpawnProcess(this.bin, args, cwd, env, cb);
  }
}

const baseEnv = process.env;

export function safeSpawnProcess(
  command: string,
  args: string[],
  cwd: string | undefined,
  env: {[s: string]: string},
  callback: (err: Error | null, code: number, signal: string, out: string) => any,
  method: 'spawn' | 'fork' = 'spawn'
) {
  var options: any = {
    encoding: 'utf8',
    //stdio: ['ignore', 'pipe', 'pipe'],
    cwd: cwd
  };
  if (method === 'fork') {
    //options.stdio.push('ipc');
    options.execArgv = [];
  }
  if (env && Object.keys(env).length) {
    var pathKey = "PATH";
    options.env = {};
    for (var i in baseEnv) {
      if (baseEnv.hasOwnProperty(i)) {
        if (i.toLowerCase() === "path")
          pathKey = i;
        options.env[i] = baseEnv[i];
      }
    }
    if (env["PATH"] && pathKey !== "PATH") {
      env[pathKey] = env["PATH"];
      delete env["PATH"];
    }
    for (var i in env) {
      if (env.hasOwnProperty(i)) {
        options.env[i] = env[i];
      }
    }
  }
  var process: child_process.ChildProcess = (child_process[method] as any)(command, args, options);
  var out = "";
  var exited = false;

  var err: Error | null = null;

  function exithandler(code, signal) {
    if (exited) return;
    exited = true;

    if (!callback) return;
    callback(err, code, signal, out);
  }

  function errorhandler(e: Error) {
    err = e;
    exithandler(-1, null);
  }

  if (process) {
    var append = function(chunk) { out += chunk; };
    if (process.stdout)
      process.stdout.addListener('data', append);
    if (process.stderr)
      process.stderr.addListener('data', append);
    process.addListener('close', exithandler);
    process.addListener('error', errorhandler);
  }
  else {
    err = new Error("could not create child_process object");
    exithandler(-1, null);
  }
  return process;
}
