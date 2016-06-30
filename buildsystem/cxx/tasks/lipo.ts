import {Task, declareTask, Graph, File} from '../../core'
import {LinkTask} from './link';
import {ProcessTask} from '../../foundation';

@declareTask({ type: "lipo" })
export class LipoTask extends ProcessTask {
  constructor(graph: Graph, linkTasks: LinkTask[], finalFile: File) {
    var inputs = linkTasks.map(function (task) {
      return task.outputFiles[0];
    });
    super({ type: "link", name: finalFile.name }, graph, inputs, [finalFile], {linker:"lipo"});
    this.addDependencies(linkTasks);
    this.appendArgs(["-create"]);
    linkTasks.forEach((task) => {
      this.appendArgs([[task.outputFiles[0]]]);
    });
    this.appendArgs(["-output", [finalFile.path]]);
  }
}
