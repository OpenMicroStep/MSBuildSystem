import {Task, Graph, File, Reporter, Step, Barrier, FileElement} from '../index.priv';
import * as path from 'path';

@Task.declare(["copy"], {
  files: FileElement.validateFileGroup,
})
export class CopyTask extends Task {
  protected steps: File[] = [];

  constructor(name: string, graph: Graph) {
    super({ type: "copy", name: name }, graph);
  }

  uniqueKey() {
    return this.steps.map(s => s.path);
  }

  configure(reporter: Reporter, { files }: { files: FileElement.FileGroup[] }) {
    this.willCopyFileGroups(reporter, files, this.target().paths.output);
  }

  willCopyFileGroups(reporter: Reporter, groups: FileElement.FileGroup[], destBase: string) {
    for (var group of groups)
      this.willCopyFiles(reporter, group.elements, path.join(destBase, group.dest), group.expand);
  }

  willCopyFiles(reporter: Reporter, files: File[], outDir: string, expand: boolean) {
    var commonPart = expand ? File.commonDirectoryPath(files) : "";
    for (var i = 0, len = files.length; i < len; i++) {
      var file = files[i];
      var p = expand
            ? path.join(outDir, commonPart ? path.relative(commonPart, file.path) : file.name)
            : path.join(outDir, file.name);
      this.willCopyFile(reporter, file, File.getShared(p, file.isDirectory));
    }
  }

  willCopyFile(reporter: Reporter, file: File, to: File) {
    if (file.isDirectory || to.isDirectory)
      reporter.diagnostic({ is: "warning", msg: `willCopyFile doesn't support copying directory, ignoring ${file.path}` });
    else
      this.steps.push(to, file);
  }

  foreach(fn: (from: File, to: File) => void) {
    for (let i = 1, len = this.steps.length; i < len; i += 2) {
      let from = this.steps[i];
      let to = this.steps[i - 1];
      fn(from, to);
    }
  }

  do_build(step: Step<{ actionRequired: boolean }>) {
    let did = 0;
    let barrier = new Barrier("Copy files", this.steps.length / 2);
    for (let i = 1, len = this.steps.length; i < len; i += 2) {
      let from = this.steps[i];
      let to = this.steps[i - 1];
      from.copyTo(to, step.context.lastSuccessStartTime, step.context.lastSuccessEndTime, (err, copied) => {
        if (err || copied)
          did++;
        if (err)
          step.context.reporter.diagnostic({ is: "error", msg: "couldn't copy file: " + err + this});
        barrier.dec();
      });
    }
    barrier.endWith(() => {
      step.context.actionRequired = did > 0;
      step.continue()
    });
  }
  do_clean(step: Step<{}>) {
    let elements: ((f: Step<{}>) => void)[] = [];
    this.foreach((from, to) => {
      elements.push(f => to.unlink(f));
    });
    step.setFirstElements(elements);
    step.continue();
  }

  protected buildOutputFileChecker(set: Set<string>) : ((absolute_path: string) => boolean) | void {
    this.foreach((from, to) => set.add(to.path));
  }
}
