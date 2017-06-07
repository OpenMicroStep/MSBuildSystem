import { Task, Node, Step, File, Graph } from '../index.priv';

export class InOutTask extends Task {
  constructor(name: Node.Name, graph: Graph, public inputFiles: File[] = [], public outputFiles: File[] = []) {
    super(name, graph);
  }

  uniqueKey() {
    return {
      inputs: this.inputFiles.map(i => i.path),
      outputs: this.outputFiles.map(i => i.path)
    };
  }

  is_build_required(step: Step<{ actionRequired?: boolean }>) {
    step.context.actionRequired = false;
    step.setFirstElements([
      (step) => {
        if (this.outputFiles.length) {
          // Force creation of output file directories
          File.ensure(this.outputFiles, step.context.lastSuccessTime, {ensureDir: true}, (err, required) => {
            step.context.actionRequired = !!(err || required);
            step.continue();
          });
        }
        else {
          step.continue();
        }
      },
      (step) => {
        if (this.inputFiles.length && !step.context.actionRequired) {
          File.ensure(this.inputFiles, step.context.lastSuccessTime, {}, (err, required) => {
            step.context.actionRequired = !!(err || required);
            step.continue();
          });
        }
        else {
          step.continue();
        }
      }
    ]);
    step.continue();
  }

  do_clean(step: Step<{}>) {
    step.setFirstElements(this.outputFiles.map(f => flux => f.unlink(flux)));
    step.continue();
  }

  listOutputFiles(set: Set<File>) {
    this.outputFiles.forEach((out) => { set.add(out); });
  }
}
