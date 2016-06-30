import {Task, Graph, File, declareTask, AttributeTypes, Reporter, Step, Barrier} from '../core';
import * as path from 'path';
import * as fs from 'fs-extra';

//@declareTask({ type: "copy" })
export class CopyTask extends Task {
  public steps : File[] = [];
  
  constructor(name: string, graph: Graph) {
    super({ type: "copy", name: name }, graph);
  }
  
  willCopyFiles(reporter: Reporter, files: File[], outDir: string, expand: boolean) {
    var commonPart = expand ? File.commonDirectory(files) : "";
    for (var i = 0, len = files.length; i < len; i++) {
      var file = files[i];
      var p = expand 
            ? path.join(outDir, commonPart ? path.relative(file.path, commonPart) : file.name) 
            : path.join(outDir, file.name);
      this.willCopyFile(reporter, file, File.getShared(p, file.isDirectory));
    }
  }
  
  willCopyFile(reporter: Reporter, file: File, to: File) {
    if (file.isDirectory || to.isDirectory)
      reporter.diagnostic({ type: "warning", msg: `willCopyFile doesn't support copying directory, ignoring ${file.path}` });
    else
      this.steps.push(file, to);
  }

  run(step: Step) {    
    let barrier = new Barrier("Copy files", this.steps.length / 2);
    for (let i = 1, len = this.steps.length; i < len; i += 2) {
      let from = this.steps[i];
      let to = this.steps[i - 1];
      to.copyTo(to, step.lastSuccessTime, (err) => {
        if (err)
          step.diagnostic({type: "error", msg: "couldn't copy file: " + err.message});
        barrier.dec();
      });
    }
    barrier.endWith(step.continue.bind(step));
  }
  clean(step: Step) {
    let barrier = new Barrier("Clean copied files", this.steps.length / 2);
    let dec = barrier.decCallback();
    for (let i = 1, len = this.steps.length; i < len; i += 2) {
      let from = this.steps[i];
      let to = this.steps[i - 1];
      to.unlink((err) => {
        if (err)
          step.diagnostic({type: "error", msg: "couldn't unlike file: " + err.message});
        barrier.dec();
      });
    }
    barrier.endWith(step.continue.bind(step));
  }

  listOutputFiles(set: Set<File>) {
    var steps = this.steps;
    for (var i = 0, len = steps.length; i < len; i+= 2)
      set.add(steps[i]);
  }
}
