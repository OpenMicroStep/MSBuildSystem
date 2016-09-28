import {Task, Graph, File, declareTask, Reporter, Step, Barrier} from '@msbuildsystem/core';
import * as path from 'path';

@declareTask({ type: "copy" })
export class CopyTask extends Task {
  protected steps: File[] = [];

  constructor(name: string, graph: Graph) {
    super({ type: "copy", name: name }, graph);
  }

  willCopyFileGroups(reporter: Reporter, groups: { values: File[], ext: { dest: string, expand: boolean }}[], destBase: string) {
    for (var group of groups)
      this.willCopyFiles(reporter, group.values, path.join(destBase, group.ext.dest), group.ext.expand);
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

  foreach(fn: (from: File, to: File) => void) {
    for (let i = 1, len = this.steps.length; i < len; i += 2) {
      let from = this.steps[i];
      let to = this.steps[i - 1];
      fn(from, to);
    }
  }

  run(step: Step) {
    let barrier = new Barrier("Copy files", this.steps.length / 2);
    for (let i = 1, len = this.steps.length; i < len; i += 2) {
      let from = this.steps[i];
      let to = this.steps[i - 1];
      from.copyTo(to, step.lastSuccessTime, (err) => {
        if (err)
          step.diagnostic({type: "error", msg: "couldn't copy file: " + err.message});
        barrier.dec();
      });
    }
    barrier.endWith(step.continue.bind(step));
  }
  clean(step: Step) {
    let barrier = new Barrier("Clean copied files", this.steps.length / 2);
    for (let i = 1, len = this.steps.length; i < len; i += 2) {
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
    for (var i = 0, len = steps.length; i < len; i += 2)
      set.add(steps[i]);
  }
}
