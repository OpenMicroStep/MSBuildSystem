/// <reference path="../../typings/tsd.d.ts" />
/* @flow weak */
'use strict';

import Provider = require('../core/Provider');
import Process = require('../core/Process');
import Graph = require('../core/Graph');
import Task = require('../core/Task');
import Barrier = require('../core/Barrier');
import File = require('../core/File');

class ProcessTask extends Task {
  public provider : Provider.Process = null;
  public args: string[] = [];
  public env: {[s:string]: string};
  constructor(name: string, graph: Graph, public inputFiles: File[] = [], public outputFiles: File[] = []) {
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

  isRunRequired(callback: (err: Error, required?:boolean) => any) {
    if(this.inputFiles.length && this.outputFiles.length) {
      var barrier = new File.EnsureBarrier("Compile.isRunRequired", 2);
      File.ensure(this.inputFiles, this.data.lastSuccessTime, {log: true}, barrier.decCallback());
      File.ensure(this.outputFiles, this.data.lastSuccessTime, {ensureDir: true, log: true}, barrier.decCallback());
      barrier.endWith(callback);
    }
    else {
      callback(null, true);
    }
  }

  runProcess(callback : (err: string, output: string) => any) {
    this.provider.process(this.inputFiles, this.outputFiles, "runTask", {
      args: this.args,
      env: this.env
    }, callback);
  }
  run() {
    if(!this.provider) {
      this.log("'provider' is null");
      this.end(1);
    }
    else {
      this.runProcess((err, output) => {
        if(output) this.log("\n" + output);
        if(err) this.log(err);
        this.end(err ? 1 : 0);
      });
    }
  }

  clean() {
    var errors = 0;
    var barrier = new Barrier("Clear process product", this.outputFiles.length);
    this.outputFiles.forEach((file) => {
      file.unlink((err) => {
        this.log("unlink " + file.path);
        if (err) {
          this.log(err.toString());
          ++errors;
        }
        barrier.dec();
      })
    });
    barrier.endWith(() => {
      this.end(errors);
    });
  }
}

export = ProcessTask;