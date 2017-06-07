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
    safeSpawnProcess(step, { cmd: [this.bin, ...args], cwd: options.cwd, env: env });
  }
}

const baseEnv = process.env;
export interface SafeSpawnParams {
  cmd: string[] | string;
  cwd?: string;
  env?: {[s: string]: string};
  tty?: boolean;
  method?: 'spawn' | 'fork';
  shell?: boolean;
};

function toShellArg(arg: string) : string {
  if (process.platform === 'win32')
    return `"${arg.replace(/(\\|")/g, '\\$1')}"`;
  return `'${arg.replace("'", "''")}`;
}
export function safeSpawnProcess(step: Step<{}>, p: SafeSpawnParams) {
  let method = p.method || 'spawn';
  var options: any = {
    encoding: 'utf8',
    //stdio: ['ignore', 'pipe', 'pipe'],
    cwd: p.cwd
  };
  if (p.tty)
    options.stdio = ['ignore', process.stdout, process.stderr];
  let pcmd = p.cmd;
  options.shell = p.shell || typeof pcmd === "string";
  if (method === 'fork') {
    //options.stdio.push('ipc');
    options.execArgv = [];
  }
  else if (options.shell && Array.isArray(pcmd)) {
    pcmd = pcmd.map(arg => toShellArg(arg)).join(' ');
  }
  if (p.env && Object.keys(p.env).length) {
    var pathKey = "PATH";
    options.env = {};
    for (var i in baseEnv) {
      if (baseEnv.hasOwnProperty(i)) {
        if (i.toLowerCase() === "path")
          pathKey = i;
        options.env[i] = baseEnv[i];
      }
    }
    if (p.env["PATH"] && pathKey !== "PATH") {
      p.env[pathKey] = p.env["PATH"];
      delete p.env["PATH"];
    }
    for (var i of Object.getOwnPropertyNames(p.env)) {
        options.env[i] = p.env[i];
    }
  }
  var proc: child_process.ChildProcess = Array.isArray(pcmd)
    ? (child_process[method] as any)(pcmd[0], pcmd.slice(1), options)
    : (child_process[method] as any)(pcmd, [], options);
  var out = "";
  var exited = false;

  var err: Error | null = null;

  function cmd() {
    return Array.isArray(p.cmd) ? p.cmd.map(a => /\s/.test(a) ? `"${a}"` : a).join(' ') : p.cmd;
  }

  function callback(err, code, signal, out) {
    if (p.tty)
      process.stderr.write(`∧ [${signal || code}] ${cmd()}\n`);
    if (err)
      step.context.reporter.error(err);
    if (out || signal || code !== 0) {
      step.context.reporter.failed = !!(signal || code !== 0);
      step.context.reporter.log(`${cmd()}\n`);
      if (out)
        step.context.reporter.log(out);
      if (signal)
        step.context.reporter.log(`process terminated with signal ${signal}`);
      if (code !== 0)
        step.context.reporter.log(`process terminated with exit code: ${code}`);
    }
    step.continue();
  }

  function exithandler(code, signal) {
    if (exited) return;
    exited = true;
    callback(err, code, signal, out);
  }

  function errorhandler(e: Error) {
    err = e;
    exithandler(-1, null);
  }

  if (p.tty)
    process.stderr.write(`∨ ${cmd()}\n`);
  if (proc) {
    var append = function(chunk) { out += chunk; };
    if (!p.tty && proc.stdout)
      proc.stdout.addListener('data', append);
    if (!p.tty && proc.stderr)
      proc.stderr.addListener('data', append);
    proc.addListener('close', exithandler);
    proc.addListener('error', errorhandler);
  }
  else {
    err = new Error("could not create child_process object");
    exithandler(-1, null);
  }
  return proc;
}
