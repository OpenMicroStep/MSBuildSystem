/// <reference path="../../typings/tsd.d.ts" />
/* @flow weak */
import Task = require('../core/Task');
import Barrier = require('../core/Barrier');
import File = require('../core/File');
var fs = require('fs-extra');
var path = require('path');

class CopyTask extends Task {
  public steps : [File, File][] = [];
  constructor(name: string) {
    super(name);
  }

  /** Make this task copy files 'inFiles' to the directory 'outDir' */
  willCopyFilesToDir(inFiles: string[], outDir: string) {
    inFiles.forEach((file) => {
      this.willCopyFile(file, path.join(outDir, path.basename(file)));
    });
  }
  /** Make this task copy file 'inFile' to 'outFile' */
  willCopyFile(inFile: string, outFile: string) {
    this.steps.push([File.getShared(inFile), File.getShared(outFile)]);
  }
  run() {
    var barrier = new Barrier("Copy files", this.steps.length);
    var errors = 0;
    this.steps.forEach((step) => {
      fs.copy(step[0].path, step[1].path, { replace: true }, (err) => {
        this.log("copy " + step[0].path + " to " + step[1].path);
        if(err) {
          ++errors;
          this.log(err.toString());
        }
        barrier.dec();
      });
    });
    barrier.endWith(() => {
      this.end(errors);
    });
  }
  clean() {
    var barrier = new Barrier("Clean copied files", this.steps.length);
    var errors = 0;
    this.steps.forEach((step) => {
      step[1].unlink((err) => {
        this.log("unlink " + step[1].path);
        if(err) {
          ++errors;
          this.log(err.toString());
        }
        barrier.dec();
      });
    });
    barrier.endWith(() => {
      this.end(errors);
    });
  }
}
Task.registerClass(CopyTask, "Copy");


export = CopyTask;
