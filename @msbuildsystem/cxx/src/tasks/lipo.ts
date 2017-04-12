import {declareTask, Graph, File} from '@openmicrostep/msbuildsystem.core';
import {CXXLinkType, LinkTask} from '../index.priv';

@declareTask({ type: "lipo" })
export class LipoTask extends LinkTask {
  constructor(graph: Graph, linkTasks: LinkTask[], finalFile: File) {
    super(graph, finalFile, CXXLinkType.DYNAMIC, {linker: "lipo"});
    this.appendArgs(["-create"]);
    linkTasks.forEach((task) => {
      this.appendArgs([[task.outputFiles[0]]]);
    });
    this.appendArgs(["-output", [finalFile.path]]);
  }
}
