import {File, Task, Graph, Step} from '@openmicrostep/msbuildsystem.core';
import * as fs from 'fs';
import * as path from 'path';

export class HeaderAliasTask extends Task {
  public steps: [File, File][] = [];
  aliaspath: string;

  constructor(graph: Graph, aliaspath: string) {
    super({ type: "headeralias", name: "generate header aliases" }, graph);
    this.aliaspath = aliaspath;
  }

  /** Make this task copy file 'inFile' to 'outFile' */
  willAliasHeader(inFile: File, outFile: File) {
    this.steps.push([inFile, outFile]);
  }

  do_build(fstep: Step<{}>) {
    var i = 0;
    var step = () => {
      if (i < this.steps.length) {
        var s = this.steps[i++];
        s[1].ensure(true, fstep.context.lastSuccessTime, (err, changed) => {
          if (err) { fstep.context.reporter.error(err); fstep.continue(); }
          else if (changed) {
            fs.writeFile(s[1].path, "#import \"" + path.relative(this.aliaspath, s[0].path) + "\"\n", 'utf8', (err) => {
              if (err) { fstep.context.reporter.error(err); fstep.continue(); }
              else step();
            });
          }
          else {
            step();
          }
        });
      }
      else {
        fstep.continue();
      }
    };
    step();
  }

  do_clean(fstep) {
    var i = 0;
    var step = () => {
      if (i < this.steps.length) {
        var s = this.steps[i++];
        fs.unlink(s[1].path, (err) => {
          if (err) { fstep.error(err); return fstep.continue(); }
          step();
        });
      }
      else {
        fstep.continue();
      }
    };
    step();
  }

  listOutputFiles(set: Set<File>) {
    this.steps.forEach((step) => { set.add(step[1]); });
  }
}
