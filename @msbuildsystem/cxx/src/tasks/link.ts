import {File, declareTask, Graph, AttributeTypes, Reporter, AttributePath, Target, Directory} from '@openmicrostep/msbuildsystem.core';
import {ProcessTask} from '@openmicrostep/msbuildsystem.foundation';
import {CXXLinkType} from '../index.priv';

export interface LinkerOptions {
  linker: string | undefined;
  linkFlags: string[];
  libraries: string[];
  archives: string[];
  libDirectories: Directory[];
  frameworkDirectories: Directory[];
}

export const validateLinkerOptions = AttributeTypes.mergedObjectListValidator<LinkerOptions, Target>({
    'linker'              : { validator: AttributeTypes.validateString    , default: undefined },
    'linkFlags'           : { validator: AttributeTypes.validateStringList, default: []   },
    'libraries'           : { validator: AttributeTypes.validateStringList, default: []   },
    'archives'            : { validator: AttributeTypes.validateStringList, default: []   },
    'libDirectories'      : { validator: AttributeTypes.listValidator(Target.validateDirectory), default: [] },
    'frameworkDirectories': { validator: AttributeTypes.listValidator(Target.validateDirectory), default: [] },
});

@declareTask({ type: "cxxlink" })
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
