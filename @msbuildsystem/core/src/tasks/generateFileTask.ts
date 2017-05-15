import {InOutTask, Graph, File, Node} from '../index.priv';

export abstract class GenerateFileTask extends InOutTask {
  constructor(name: Node.Name, graph: Graph, dest: File) {
    super(name, graph, [], [dest]);
  }

  abstract uniqueKeyInfo() : any;
  abstract generate() : Buffer;

  uniqueKey() {
    return Object.assign(super.uniqueKey(), {
      info: this.uniqueKeyInfo()
    });
  }

  do_build(step) {
    this.outputFiles[0].writeFile(this.generate(), (err) => {
      step.context.reporter.error(err);
      step.continue();
    });
  }
}
