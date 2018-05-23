import {
  Target, Reporter, AttributeTypes,
  File, FileElement, Step,
} from '@openmicrostep/msbuildsystem.core';
import {
  JSCompilers, JSCompiler,
  JSPackagers, JSPackager,
} from './index';

export class JSTarget extends Target {
  compiler: JSCompiler;
  packager: JSPackager;
  files: Set<File>;

  buildGraph(reporter: Reporter) {
    super.buildGraph(reporter);
    this.packager.addDependency(this.compiler);
    this.compiler.buildGraph(reporter);
    this.packager.buildGraph(reporter);
  }

  absoluteCopyFilesPath() {
    return this.packager.absoluteCompilationOutputDirectory();
  }

  configureExports(reporter: Reporter) {
    super.configureExports(reporter);
    this.compiler.configureExports(reporter);
    this.packager.configureExports(reporter);
  }
}
Target.register(["javascript"], JSTarget, {
  files:    FileElement.validateFileSet,
  compiler: JSCompilers.validate,
  packager: JSPackagers.validate,
});
