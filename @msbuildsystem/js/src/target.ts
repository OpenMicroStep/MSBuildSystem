import {
  declareTarget, Target, Reporter, resolver,
  AttributeResolvers, File, FileElement, SelfBuildGraph
} from '@msbuildsystem/core';
import {CopyTask} from '@msbuildsystem/foundation';
import {JSCompilers, JSCompiler, JSPackagers, JSPackager} from './index';

@JSCompilers.declare(['js'])
export class DefaultJSCompiler extends SelfBuildGraph<JSTarget> {
  constructor(graph: JSTarget) {
    super({ type: "compiler", name: "javascript" }, graph);
  }

  buildGraph(reporter: Reporter) {
    let cpy = new CopyTask("javascript", this);
    cpy.willCopyFiles(reporter, this.graph.files, this.graph.paths.output, true);
  }
}

@declareTarget({ type: "javascript" })
export class JSTarget extends Target {

  @resolver(JSCompilers.resolver)
  compiler: JSCompiler | null = null;

  @resolver(JSPackagers.resolver)
  packager: JSPackager | null = null;

  @resolver(new AttributeResolvers.ListResolver(FileElement.fileValidator))
  files: File[];

  buildGraph(reporter: Reporter) {
    if (!this.compiler)
      this.compiler = new DefaultJSCompiler(this);
    this.compiler.buildGraph(reporter);
    if (this.packager)
      this.packager.buildGraph(reporter);
  }
}
