/// <reference path="../../typings/tsd.d.ts" />
/* @flow weak */
import Process = require('../core/Process');
import Task = require('../core/Task');
import Barrier = require('../core/Barrier');
import File = require('../core/File');

class ProcessTask extends Task {
  public bin : string = "";
  public args: string[] = [];
  constructor(name: string, public inputFiles: File[] = [], public outputFiles: File[] = []) {
    super(name);
  }

  addFlags(flags: string[]) {
    this.appendArgs(flags);
  }
  addFlagsAtEnd(flags: string[]) {
    this.appendArgs(flags);
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

  isRunRequired(callback: (err: Error, required?:boolean) => any) {
    File.ensure({
      inputs:this.inputFiles,
      outputs:this.outputFiles
    }, callback);
  }

  run() {
    if(!this.bin.length) {
      this.log("'bin' is not set");
      this.end(1);
    }
    else {
      this.log(this.bin + " \\\n\t" + this.args.join(" \\\n\t"));
      Process.run(this.bin, this.args, (err, output) => {
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