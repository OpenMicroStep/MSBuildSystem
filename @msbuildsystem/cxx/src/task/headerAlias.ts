import {File, Task, Graph, Step, Reporter, FileElement, Barrier} from '@openmicrostep/msbuildsystem.core';
import * as fs from 'fs';
import * as path from 'path';

export class HeaderAliasTask extends Task {
  protected steps: File[] = [];

  constructor(name: string, graph: Graph) {
    super({ type: "alias", name: name }, graph);
  }

  uniqueKey() {
    return this.steps.map(s => s.path);
  }

  configure(reporter: Reporter, { files }: { files: FileElement.FileGroup[] }) {
    this.willAliasFileGroups(reporter, files, this.target().paths.output);
  }

  willAliasFileGroups(reporter: Reporter, groups: FileElement.FileGroup[], destBase: string) {
    for (var group of groups)
      this.willAliasFiles(reporter, group.elements, path.join(destBase, group.dest), group.expand);
  }

  willAliasFiles(reporter: Reporter, files: File[], outDir: string, expand: boolean) {
    var commonPart = expand ? File.commonDirectoryPath(files) : "";
    for (var i = 0, len = files.length; i < len; i++) {
      var file = files[i];
      var p = expand
            ? path.join(outDir, commonPart ? path.relative(commonPart, file.path) : file.name)
            : path.join(outDir, file.name);
      this.willAliasFile(reporter, file, File.getShared(p, file.isDirectory));
    }
  }

  willAliasFile(reporter: Reporter, file: File, to: File) {
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

  do_build(step: Step<{}>) {
    let barrier = new Barrier("Alias files", this.steps.length / 2);
    for (let i = 1, len = this.steps.length; i < len; i += 2) {
      let from = this.steps[i];
      let to = this.steps[i - 1];
      to.ensure(true, step.context.lastSuccessStartTime, (err, changed) => {
        if (err) { step.context.reporter.error(err); barrier.dec(); }
        else if (changed) {
          fs.writeFile(to.path, "#import \"" + from.path + "\"\n", { encoding: 'utf8' }, (err) => {
            if (err) { step.context.reporter.error(err); step.continue(); }
            else barrier.dec();
          });
        }
        else {
          barrier.dec();
        }
      });
    }
    barrier.endWith(step.continue.bind(step));
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
