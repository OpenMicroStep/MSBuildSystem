import {
  Reporter, Step, StepWithData, Diagnostic,
  File, SemVerProvider, Loader,
} from '@openmicrostep/msbuildsystem.core';
import {
  safeSpawnProcess,
} from '@openmicrostep/msbuildsystem.foundation';
import {
  CompilerProviders, CompilerProvider, CompileAttributes,
  LinkerProviders, LinkerProvider, LinkAttributes,
} from '../index.priv';
import * as child_process from 'child_process';

export class ArProvider extends SemVerProvider implements LinkerProvider {
  constructor(public bin: string, name: string, version: string) {
    super(name, version);
  }

  do_link(step: Step, attributes: LinkAttributes) : void {
    step.setFirstElements([
      step => safeSpawnProcess(step, { cmd: [this.bin, ...this.link_arguments(step.context.reporter, attributes)] }),
      step => {
        step.continue();
      }
    ]);
    step.continue();
  }

  link_arguments(reporter: Reporter, attributes: LinkAttributes): string[] {
    let args: string[] = [];
    let linkerOptions = attributes.linkerOptions;
    args.push('rcs', attributes.outFile.path);
    for (let objFile of attributes.objFiles)
      args.push(objFile.path);
    if (linkerOptions) {
      if (linkerOptions.libraries.length)
        reporter.diagnostic({ type: "warning", msg: `linkerOptions.libraries should be empty when linker is ar, ignoring` });
      if (linkerOptions.libDirectories.length)
        reporter.diagnostic({ type: "warning", msg: `linkerOptions.libDirectories should be empty when linker is ar, ignoring` });
      if (linkerOptions.frameworkDirectories.length)
        reporter.diagnostic({ type: "warning", msg: `linkerOptions.frameworkDirectories should be empty when linker is ar, ignoring` });
      args.push(...linkerOptions.archives);
      args.push(...this.flattenArgs(linkerOptions.flags));
    }
    return args;
  }
}

Loader.safeLoadIfOutOfDate<{ semver: string }>({
  name: 'ar',
  uuid: 'FD4DB37B-D588-4E72-8225-FFF25A6F6CFA',
  init() {
    return { semver: "1.0.0" };
  },
  load({ semver }) {
    let p = new ArProvider('ar', 'ar', semver);
    LinkerProviders.register(p);
  }
});
