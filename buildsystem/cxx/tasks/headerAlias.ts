import {File, Task, declareTask, Graph, Provider, ProviderConditions, process, Step, Diagnostic} from '../../core';

export class HeaderAliasTask extends Task {
  public steps : [File, File][] = [];
  aliaspath: string;

  constructor(graph: Graph, aliaspath: string) {
    super({ type: "headeralias", name: "generate header aliases" }, graph);
    this.aliaspath = aliaspath;
  }

  /** Make this task copy file 'inFile' to 'outFile' */
  willAliasHeader(inFile: string, outFile: string) {
    this.steps.push([File.getShared(inFile), File.getShared(outFile)]);
  }

  run(fstep) {
    var i = 0;
    var step = () => {
      if (i < this.steps.length) {
        var s = this.steps[i++];
        File.ensure(fstep, [s[1]], {ensureDir: true}, (err, changed) => {
          if (err) { fstep.error(err); return fstep.continue(); }
          if (changed) {
            fs.writeFile(s[1].path, "#import \"" + path.relative(this.aliaspath, s[0].path) + "\"\n", 'utf8', (err) => {
              if (err) { fstep.error(err); return fstep.continue(); }
              step();
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
    }
    step();
  }
  clean(fstep) {
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
    }
    step();
  }

  listOutputFiles(set: Set<File>) {
    this.steps.forEach((step) => { set.add(step[1]); });
  }
}