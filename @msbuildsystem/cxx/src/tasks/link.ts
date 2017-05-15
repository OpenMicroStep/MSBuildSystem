import {File, Graph, AttributeTypes, Reporter, AttributePath, Target, Directory, ComponentElement} from '@openmicrostep/msbuildsystem.core';
import {ProcessTask} from '@openmicrostep/msbuildsystem.foundation';
import {CXXLinkType} from '../index.priv';

export interface LinkerOptions {
  linker: string | undefined;
  linkFlags: string[];
  libraries: string[];
  archives: string[];
  libDirectories: Set<Directory>;
  frameworkDirectories: Set<Directory>;
}

export const validateLinkerOptions = ComponentElement.objectValidator<LinkerOptions, Target>({
    'linker'              : AttributeTypes.validateString    ,
    'linkFlags'           : AttributeTypes.validateStringList,
    'libraries'           : AttributeTypes.validateStringList,
    'archives'            : AttributeTypes.validateStringList,
    'libDirectories'      : ComponentElement.setValidator(Target.validateDirectory),
    'frameworkDirectories': ComponentElement.setValidator(Target.validateDirectory),
});

export class LinkTask extends ProcessTask {
  type: CXXLinkType;
  constructor(graph: Graph, finalFile: File, type: CXXLinkType, provider) {
    super({ type: "link", name: finalFile.name }, graph, [], [finalFile], provider);
    this.type = type;
  }

  addOptions(options: LinkerOptions) {
    this.addFlags(options.linkFlags);
  }

  addObjFiles(files: File[]) {
    this.outputFiles.push(...files);
  }

  addLibraryFlags(libs: string[]) {
    this.addFlags(libs);
  }

  addArchiveFlags(libs: string[]) {
    this.addLibraryFlags(libs);
  }
}
