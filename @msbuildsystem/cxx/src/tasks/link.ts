import {File, declareTask, Graph, AttributeTypes, Reporter, AttributePath, Target, Directory} from '@msbuildsystem/core';
import {ProcessTask} from '@msbuildsystem/foundation';
import {CXXLinkType} from '../index.priv';

export interface LinkerOptions {
  linker: string | undefined;
  linkFlags: string[];
  libraries: string[];
  archives: string[];
  libDirectories: Directory[];
  frameworkDirectories: Directory[];
}

export const validateLinkerOptions = AttributeTypes.mergedObjectListValidator<LinkerOptions, Target>([
    { path: 'linker'              , validator: AttributeTypes.validateString    , default: undefined },
    { path: 'linkFlags'           , validator: AttributeTypes.validateStringList, default: []   },
    { path: 'libraries'           , validator: AttributeTypes.validateStringList, default: []   },
    { path: 'archives'            , validator: AttributeTypes.validateStringList, default: []   },
    { path: 'libDirectories'      , validator: AttributeTypes.listValidator(Target.validateDirectory), default: [] },
    { path: 'frameworkDirectories', validator: AttributeTypes.listValidator(Target.validateDirectory), default: [] },
]);

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
