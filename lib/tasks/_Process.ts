/// <reference path="../../typings/tsd.d.ts" />
/* @flow weak */
'use strict';

import Process = require('../core/Process');
import Graph = require('../core/Graph');
import Task = require('../core/Task');
import Barrier = require('../core/Barrier');
import File = require('../core/File');

class ProcessTask extends Task {
  public bin : string = "";
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
    return this.bin + " " + this.args.join(" ");
  }

  isRunRequired(callback: (err: Error, required?:boolean) => any) {
    if(this.inputFiles.length && this.outputFiles.length) {
      var barrier = new File.EnsureBarrier("Compile.isRunRequired", 2);
      File.ensure(this.inputFiles, this.data.lastRunEndTime, {log: true}, barrier.decCallback());
      File.ensure(this.outputFiles, this.data.lastRunEndTime, {ensureDir: true, log: true}, barrier.decCallback());
      barrier.endWith(callback);
    }
    else {
      callback(null, true);
    }
  }

  runProcess(callback) {
    Process.run(this.bin, this.args, this.env, callback);
  }
  run() {
    if(!this.bin.length) {
      this.log("'bin' is not set");
      this.end(1);
    }
    else {
      this.log(this.bin + " \\\n\t" + this.args.join(" \\\n\t"));
      this.runProcess((err, output) => {
        this.log(output);
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