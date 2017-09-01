import {
  Reporter, File, Task,
} from '@openmicrostep/msbuildsystem.core';
import {
  Toolchain, CompileResourceTask, CompileResourceAttributes
} from '../index.priv';
import * as path from 'path';

export abstract class Toolchain_windows extends Toolchain {
  createLinkObjFilesTasks(reporter: Reporter) {
    let ret = super.createLinkObjFilesTasks(reporter);
    for (let task of this.createCompileResourceTasks(reporter)) {
      ret.objFiles.add(task.attributes.resFile);
      ret.tasks.push(task);
    }
    return ret;
  }

  createCompileResourceTasks(reporter: Reporter) : CompileResourceTask[] {
    let ret: CompileResourceTask[] = [];
    for (let rcFile of this.graph.rcFiles) {
      let rc = this.createCompileResourceTask(reporter, rcFile);
      ret.push(rc);
    }
    return ret;
  }

  createCompileResourceTask(reporter: Reporter, rcFile: File) : CompileResourceTask {
    let target = this.graph;
    let relativePath = path.relative(target.project.directory, rcFile.path);
    let dstPath = path.join(target.paths.intermediates, relativePath);
    let resFile = File.getShared(`${dstPath}.res`);
    let a: CompileResourceAttributes = {
      rcFile: rcFile,
      resFile: resFile,
      compiler: '',
    };
    return new CompileResourceTask(rcFile.name, this, a);
  }
}
