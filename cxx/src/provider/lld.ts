import {
  Reporter, Step, StepWithData, Diagnostic,
  File, SemVerProvider, Loader,
} from '@openmicrostep/msbuildsystem.core';
import {
  safeSpawnProcess,
} from '@openmicrostep/msbuildsystem.foundation';
import {
  LinkerProviders, LinkerProvider, LinkAttributes,
} from '../index.priv';
import * as child_process from 'child_process';
import * as fs from 'fs-extra';
import * as path from 'path';

export class LLDProvider extends SemVerProvider implements LinkerProvider {
  constructor(public bin: string, name: string, version: string) {
    super(name, version);
  }

  do_link(step: Step<{ frameworks?: string[] }>, attributes: LinkAttributes) : void {
    step.setFirstElements([
      step => {
        let f: string[] = step.context.frameworks = [];
        if (!attributes.linkerOptions.frameworks.length)
          return step.continue();
        let dirs = [...attributes.linkerOptions.frameworkDirectories];
        Promise.all(dirs.map(dir => fs.readdir(dir.path))).then(results => {
          let remaining = new Set(attributes.linkerOptions.frameworks.map(f => `${f}.framework`));
          for (let [idx, r] of results.entries()) {
            for (let dir of r) {
              if (remaining.delete(dir)) {
                f.push(path.join(dirs[idx].path, dir, `${dir.substring(0, dir.length - ".framework".length)}.lib`));
              }
            }
          }
          for (let f of remaining) {
            step.context.reporter.diagnostic({
              is: "error", msg: `framework ${f.substring(0, f.length - ".framework".length)} not found`,
              notes: dirs.map((d): Diagnostic => ({ is: "note", msg: `not inside: ${d.path}`}))
            });
          }
          step.continue();
        }, err => {
          step.context.reporter.error(err);
          step.continue();
        });
      },
      step => safeSpawnProcess(step, { cmd: [this.bin, ...this.link_arguments(step.context.reporter, attributes), ...step.context.frameworks!] }),
      step => {
        this.parseLogs(step.context.reporter, step.context.reporter.logs);
        step.continue();
      }
    ]);
    step.continue();
  }

  link_arguments(reporter: Reporter, attributes: LinkAttributes): string[] {
    let args: string[] = [];
    let linkerOptions = attributes.linkerOptions;
    args.push('-flavor', 'link');
   // args.push(`/entry:_MyDllMainCRTStartup`);
    args.push(`/out:${attributes.outFile.path}`);
    args.push(`/debug`);

    for (let objFile of attributes.objFiles)
      args.push(objFile.path);
    if (linkerOptions) {
      args.push(...linkerOptions.libraries);
      args.push(...linkerOptions.archives);
      args.push(...this.flattenArgs(linkerOptions.flags));
      for (let d of linkerOptions.libDirectories)
        args.push(`/libpath:${d.path}`);
    }
    return args;
  }

  parseLogs(reporter: Reporter, logs: string) {
  }
}
