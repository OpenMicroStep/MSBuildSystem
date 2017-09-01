import {
  File, Directory,
  Task, Graph, Target, InOutTask, Step,
  Reporter, AttributeTypes as V, AttributePath,
  FileElement, ComponentElement} from '@openmicrostep/msbuildsystem.core';
import {LinkerProviders} from '../index.priv';

export interface LinkerOptions {
  linker: string | undefined;
  flags: (string | (string|File)[])[];
  libraries: string[];
  archives: string[];
  frameworks: string[];
  libDirectories: Directory[];
  frameworkDirectories: Directory[];
}
export namespace LinkerOptions {
  export function empty() : LinkerOptions {
    return {
      linker: undefined,
      flags: [],
      libraries: [],
      archives: [],
      frameworks: [],
      libDirectories: [],
      frameworkDirectories: [],
    };
  }
  export function merge(self: LinkerOptions, other: LinkerOptions) : LinkerOptions {
    if (other.linker && !self.linker)
      self.linker = other.linker;
    if (other.flags)
      self.flags.push(...other.flags);
    if (other.libraries)
      self.libraries.push(...other.libraries);
    if (other.frameworks)
      self.frameworks.push(...other.frameworks);
    if (other.archives)
      self.archives.push(...other.archives);
    for (let dir of other.libDirectories)
      self.libDirectories.push(dir);
    for (let dir of other.frameworkDirectories)
      self.frameworkDirectories.push(dir);
    return self;
  }
}

export type LinkAttributes = {
  objFiles: Set<File>,
  outFile: File,
  linkerOptions: LinkerOptions,
}

export const linkerExtensions: V.Extensions<LinkerOptions, Target> = {
  'linker'              : V.defaultsTo(V.validateString    , undefined),
  'flags'               : V.defaultsTo(ComponentElement.setAsListValidator(V.validateString), []),
  'libraries'           : V.defaultsTo(ComponentElement.setAsListValidator(V.validateString), []),
  'archives'            : V.defaultsTo(ComponentElement.setAsListValidator(V.validateString), []),
  'frameworks'          : V.defaultsTo(ComponentElement.setAsListValidator(V.validateString), []),
  'libDirectories'      : V.defaultsTo(ComponentElement.setAsListValidator(Target.validateDirectory), []),
  'frameworkDirectories': V.defaultsTo(ComponentElement.setAsListValidator(Target.validateDirectory), []),
};

export const validateLinkerOptions = ComponentElement.objectValidator<LinkerOptions, Target>(linkerExtensions);

@Task.declare(["cxx-link"], {
  objFiles: FileElement.validateFileSet,
  outFile: FileElement.validateFile,
  linkerOptions: V.defaultsTo(validateLinkerOptions, undefined),
})
export class LinkTask extends InOutTask {
  constructor(name: string, graph: Graph, public attributes: LinkAttributes) {
    super({type: "cxx-link", name: name}, graph, [...attributes.objFiles], [attributes.outFile]);
  }

  uniqueKey() {
    return Object.assign(super.uniqueKey(), {
      linkerOptions: this.attributes.linkerOptions,
    });
  }

  do_build(step: Step) {
    let provider = LinkerProviders.validateBest.validate(step.context.reporter, new AttributePath(), this.attributes.linkerOptions.linker);
    if (!provider) return step.continue();
    provider.do_link(step, this.attributes);
  }
}
