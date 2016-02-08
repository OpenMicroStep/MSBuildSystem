import Task = require('../core/Task');
import Graph = require('../core/Graph');
import Barrier = require('../core/Barrier');
import File = require('../core/File');
var fs = require('fs-extra');
var path = require('path');

class CopyTask extends Task {
  public steps : [File, File][] = [];
  constructor(name: string, graph: Graph) {
    super({ type: "copy", name: name }, graph);
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

  static copying = false;
  static queue: {task: CopyTask, src:string, dest: string, cb: (err) => any}[] = [];
  copy(src: string, dest: string, cb: (err) => any) {
    if (!CopyTask.copying) {
      this.runCopy(src, dest, cb);
    }
    else {
      CopyTask.queue.push({task: this, src:src, dest:dest, cb:cb});
    }
  }
  private runCopy(src: string, dest: string, cb: (err) => any) {
    CopyTask.copying= true;
    var end = function(err) {
      if (CopyTask.queue.length > 0) {
        var t= CopyTask.queue.shift();
        t.task.runCopy(t.src, t.dest, t.cb);
      }
      else {
        CopyTask.copying= false;
      }
      cb(err);
    };
    fs.copy(src, dest, {replace: true}, (err) => {
      //step.log("copy " + src + " to " + dest);
      if (err) return end(err);
      fs.stat(src, (err, stats) => {
        if (err) return end(err);
        fs.utimes(dest, stats.atime, stats.mtime, (err) => {

          end(err);
        });
      });
    });
  }
  run(fstep) {
    var barrier = new Barrier("Copy files", this.steps.length);
    var errCb = (err)=> {
      if (err) {
        fstep.error(err.toString());}
      barrier.dec();
    };
    this.steps.forEach((step) => {
      var i = step[0], o = step[1];
      var ioBarrier = new File.EnsureBarrier("Compile.isRunRequired", 2);
      File.ensure(fstep, [i], {}, ioBarrier.decCallback());
      File.ensure(fstep, [o], {ensureDir: true}, ioBarrier.decCallback());
      ioBarrier.endWith((err, required) => {
        if (err) return errCb(err);
        if (required) {
          this.copy(i.path, o.path, errCb);
        }
        else {
          barrier.dec();
        }
      });
    });
    barrier.endWith(() => {
      fstep.continue();
    });
  }
  clean(fstep) {
    var barrier = new Barrier("Clean copied files", this.steps.length);
    this.steps.forEach((step) => {
      step[1].unlink((err) => {
        fstep.log("unlink " + step[1].path);
        if(err) {
          fstep.error(err.toString());
        }
        barrier.dec();
      });
    });
    barrier.endWith(() => {
      fstep.continue();
    });
  }

  listOutputFiles(set: Set<File>) {
    this.steps.forEach((step) => { set.add(step[1]); });
  }
}
Task.registerClass(CopyTask, "Copy");


export = CopyTask;
