import {
  Target, SelfBuildGraph, File, Reporter,
  AttributeTypes as V,
  FileElement, ComponentElement,
} from '@openmicrostep/msbuildsystem.core';
import {
  Toolchain, Toolchains,
  CompilerOptions, validateCompilerOptions, compilerExtensions,
  LinkerOptions, validateLinkerOptions
} from '../index.priv';
import * as path from 'path';

export enum CXXLinkType {
  STATIC,
  DYNAMIC,
  EXECUTABLE
}

/**
 * Base target for C/C++ targets (library, framework, executable)
 * The sysroot is responsible of the build graph creation
*/
export abstract class CXXTarget extends Target {
  toolchain: Toolchain;
  compilerOptions: CompilerOptions;
  linkerOptions: LinkerOptions;
  files: ComponentElement.Group<File, CompilerOptions>[];
  rcFiles: Set<File>;

  linkType: CXXLinkType;

  buildGraph(reporter: Reporter) {
    super.buildGraph(reporter);
    this.toolchain.buildGraph(reporter);
  }
}
SelfBuildGraph.registerAttributes(CXXTarget, {
  toolchain      : Toolchains.validate,
  compilerOptions: V.chain(V.defaultsTo(V.validateAny, {}), validateCompilerOptions),
  linkerOptions  : V.chain(V.defaultsTo(V.validateAny, {}), validateLinkerOptions),
  files          : ComponentElement.groupValidator(FileElement.validateFile, compilerExtensions),
  rcFiles        : V.defaultsTo(FileElement.validateFileSet, new Set()),
});
