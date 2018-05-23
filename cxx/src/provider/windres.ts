import {
  Reporter, Step, StepWithData, Diagnostic,
  File, SemVerProvider, Loader,
} from '@openmicrostep/msbuildsystem.core';
import {
  safeSpawnProcess,
} from '@openmicrostep/msbuildsystem.foundation';
import {
  ResourceCompilerProviders, ResourceCompilerProvider, CompileResourceAttributes,
} from '../index.priv';
import * as child_process from 'child_process';
import * as fs from 'fs-extra';
import * as path from 'path';

export class WindresProvider extends SemVerProvider implements ResourceCompilerProvider {
  constructor(public bin: string, name: string, version: string) {
    super(name, version);
  }

  do_compile_resource(step: Step, attributes: CompileResourceAttributes) : void {
    safeSpawnProcess(step, { cmd: [
      this.bin,
      "--input-format=rc", "-i", attributes.rcFile.path,
      "--output-format=res", "-o", attributes.resFile.path,
    ] });
  }
}
