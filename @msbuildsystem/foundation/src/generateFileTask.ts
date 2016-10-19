import {Task, TaskName, Graph, File, Step} from '@msbuildsystem/core';
import * as fs from 'fs';
import {Hash} from 'crypto';

export abstract class GenerateFileTask extends Task {
  constructor(name: TaskName, graph: Graph, public path: string) {
    super(name, graph);
  }

  abstract uniqueKeyInfo() : any;
  abstract generate() : Buffer;

  uniqueKey(hash: Hash) {
    hash.update(JSON.stringify({info: this.uniqueKeyInfo(), path: this.path}));
    return true;
  }

  isRunRequired(step: Step) {
    File.getShared(this.path).ensure(true, step.lastSuccessTime, (err, required) => {
      step.context.runRequired = !!(err || required);
      step.continue();
    });
  }
  run(step) {
    fs.writeFile(this.path, this.generate(), (err) => {
      if (err) step.error(err.toString());
      step.continue();
    });
  }
  clean(step) {
    fs.unlink(this.path, (err) => {
      if (err && (<NodeJS.ErrnoException>err).code !== "ENOENT")
        step.error(err);
      step.continue();
    });
  }
}
