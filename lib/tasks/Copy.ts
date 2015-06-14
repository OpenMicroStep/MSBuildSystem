/// <reference path="../../typings/tsd.d.ts" />
/* @flow weak */
'use strict';

import Task = require('../core/Task');
import Graph = require('../core/Graph');
import Barrier = require('../core/Barrier');
import File = require('../core/File');
var fs = require('fs-extra');
var path = require('path');

class CopyTask extends Task {
  public steps : [File, File][] = [];
  constructor(name: string, graph: Graph) {
    super(name, graph);
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
    var errCb = (err)=> {
      ++errors;
      this.log(err.toString());
      barrier.dec();
    };
    this.steps.forEach((step) => {
      var i = step[0], o = step[1];
      var ioBarrier = new File.EnsureBarrier("Compile.isRunRequired", 2);
      File.ensure([i], this.data.lastRunEndTime, {}, ioBarrier.decCallback());
      File.ensure([o], this.data.lastRunEndTime, {ensureDir: true}, ioBarrier.decCallback());
      ioBarrier.endWith((err, required) => {
        if (err) return errCb(err);
        if (required) {
          fs.copy(i.path, o.path, {replace: true}, (err) => {
            this.log("copy " + i.path + " to " + o.path);
            if (err) return errCb(err);
            fs.stat(i.path, (err, stats) => {
              if (err) return errCb(err);
              fs.utimes(o.path, stats.atime, stats.mtime, (err) => {
                if (err) return errCb(err);
                barrier.dec();
              });
            });
          });
        }
        else {
          barrier.dec();
        }
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
