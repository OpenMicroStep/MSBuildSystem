import {
  declareTarget, Target, Reporter, resolver, AttributeTypes,
  File, FileElement
} from '@msbuildsystem/core';
import {
  JSCompilers, JSCompiler,
  JSPackagers, JSPackager
} from './index';

@declareTarget({ type: "javascript" })
export class JSTarget extends Target {

  @resolver(JSCompilers.validate)
  compiler: JSCompiler;

  @resolver(JSPackagers.validate)
  packager: JSPackager;

  @resolver(AttributeTypes.listValidator(FileElement.validateFile))
  files: File[];

  buildGraph(reporter: Reporter) {
    this.compiler.buildGraph(reporter);
    this.packager.buildGraph(reporter);
  }
}
