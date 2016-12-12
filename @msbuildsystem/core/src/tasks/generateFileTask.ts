import {InOutTask, TaskName, Graph, File, Step} from '../index.priv';
import {Hash} from 'crypto';

export abstract class GenerateFileTask extends InOutTask {
  constructor(name: TaskName, graph: Graph, path: string) {
    super(name, graph, [], [File.getShared(path)]);
  }

  abstract uniqueKeyInfo() : any;
  abstract generate() : Buffer;

  uniqueKey(hash: Hash) {
    hash.update(JSON.stringify({info: this.uniqueKeyInfo(), path: this.outputFiles[0].path}));
    return true;
  }

  isRunRequired(step: Step<{ runRequired?: boolean }>) {
    this.outputFiles[0].ensure(true, step.context.lastSuccessTime, (err, required) => {
      step.context.runRequired = !!(err || required);
      step.continue();
    });
  }
  run(step) {
    this.outputFiles[0].writeFile(this.generate(), (err) => {
      step.context.reporter.error(err);
      step.continue();
    });
  }
  clean(step: Step<{}>) {
    this.outputFiles[0].unlink((err) => {
      step.context.reporter.error(err);
      step.continue();
    });
  }
}
