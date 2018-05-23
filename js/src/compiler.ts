import {
  Reporter, CopyTask,
  SelfBuildGraph, createBuildGraphProviderList, BuildGraphProviderList,
} from '@openmicrostep/msbuildsystem.core';
import {JSTarget} from './index';

export type JSCompiler = SelfBuildGraph<JSTarget>;

export class DefaultJSCompiler extends SelfBuildGraph<JSTarget> implements JSCompiler {
  constructor(graph: JSTarget) {
    super({ type: "compiler", name: "javascript default" }, graph);
  }

  buildGraph(reporter: Reporter) {
    let cpy = new CopyTask("javascript", this);
    cpy.willCopyFiles(reporter, [...this.graph.files], this.graph.paths.output, true);
  }
}

export const JSCompilers = createBuildGraphProviderList<JSTarget, JSCompiler>('compiler', DefaultJSCompiler);
