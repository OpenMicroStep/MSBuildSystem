import { Task, Step, File, TaskName, Graph, Barrier } from '../index.priv';

export class InOutTask extends Task {
  constructor(name: TaskName, graph: Graph, public inputFiles: File[] = [], public outputFiles: File[] = []) {
    super(name, graph);
  }

  uniqueKey() {
    return {
      inputs: this.inputFiles.map(i => i.path),
      outputs: this.outputFiles.map(i => i.path)
    };
  }

  isRunRequired(step: Step<{ runRequired?: boolean }>) {
    if (this.inputFiles.length && this.outputFiles.length) {
      // Force creation of output file directories
      File.ensure(this.outputFiles, step.context.lastSuccessTime, {ensureDir: true}, (err, required) => {
        if (err || required) {
          step.context.runRequired = true;
          step.continue();
        }
        else {
          File.ensure(this.inputFiles, step.context.lastSuccessTime, {}, (err, required) => {
            step.context.runRequired = !!(err || required);
            step.continue();
          });
        }
      });
    }
    else {
      step.context.runRequired = step.context.lastSuccessTime === 0;
      step.continue();
    }
  }

  clean(step: Step<{}>) {
    var barrier = new Barrier("Clear outputs", this.outputFiles.length);
    this.outputFiles.forEach((file) => {
      file.unlink((err) => {
        step.context.reporter.log("unlink " + file.path + (err ? " failed" : "succeeded"));
        if (err)
          step.context.reporter.error(err);
        barrier.dec();
      });
    });
    barrier.endWith(() => {
      step.continue();
    });
  }

  listOutputFiles(set: Set<File>) {
    this.outputFiles.forEach((out) => { set.add(out); });
  }
}
