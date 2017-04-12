import {
  declareTarget, Target, Reporter, resolver, AttributeTypes, AttributePath,
  File, FileElement, Step
} from '@openmicrostep/msbuildsystem.core';
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
    super.buildGraph(reporter);
    this.packager.addDependency(this.compiler);
    this.compiler.buildGraph(reporter);
    this.packager.buildGraph(reporter);
  }

  requiredDo(step: Step<{}>) {
    if (step.context.runner.action !== "generate")
      return super.requiredDo(step);

    let ide: string = step.context.runner.options['ide'];
    switch (ide) {
      case 'terminal': return super.requiredDo(step);
      default:
        step.context.reporter.diagnostic({ type: "error", msg: `unsupported ide generation: '${ide}'` });
        return step.continue();
    }
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
