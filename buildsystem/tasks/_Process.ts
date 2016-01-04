/// <reference path="../../typings/tsd.d.ts" />
/* @flow weak */
'use strict';

import Provider = require('../core/Provider');
import Process = require('../core/Process');
import Graph = require('../core/Graph');
import Task = require('../core/Task');
import Barrier = require('../core/Barrier');
import File = require('../core/File');
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

  isRunRequired(callback: (err: Error, required?:boolean) => any) {
    if(this.inputFiles.length && this.outputFiles.length) {
      var barrier = new File.EnsureBarrier("Compile.isRunRequired", 2);
      File.ensure(this.inputFiles, this.data.lastSuccessTime, {}, barrier.decCallback());
      File.ensure(this.outputFiles, this.data.lastSuccessTime, {ensureDir: true}, barrier.decCallback());
      barrier.endWith(callback);
    }
    else {
      callback(null, true);
    }
  }

  runProcess(provider: Provider, callback : (err: string, output: string) => any) {
    provider.process(this.inputFiles, this.outputFiles, "runTask", {
      args: this.args,
      env: this.env
    }, callback);
  }

  run() {
    var provider = Provider.find(this.provider);
    if(!provider) {
      this.log("'provider' not found");
      this.end(1);
    }
    else {
      this.runProcess(provider, (err, output) => {
        if (output) this.log(output);
        if (output && err) this.log("\n");
        if (err) this.log(err);
        this.end(err ? 1 : 0);
      });
    }
  }

  postprocess() {
    this.tmpData.command = { provider: this.provider, args: this.args };
    super.postprocess();
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