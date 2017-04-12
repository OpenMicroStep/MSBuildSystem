import {
  Target, File, Reporter,
  AttributePath, AttributeTypes,
  resolver, FileElement
} from '@openmicrostep/msbuildsystem.core';
import {
  CXXSysroot, CXXSysroots,
  CompilerOptions, validateCompilerOptions, compilerExtensions,
  LinkerOptions, validateLinkerOptions
} from './index.priv';

export var CXXSourceExtensions: { [s: string]: string } =  {
  '.m' : 'OBJC',
  '.c' : 'C',
  '.mm' : 'OBJCXX',
  '.cc' : 'CXX',
  '.cpp' : 'CXX',
  '.s' : 'ASM',
  '.S' : 'ASM',
  '.asm' : 'ASM'
};

export function isCXXSourceFile(file: File) {
  return !!CXXSourceExtensions[file.extension];
}

export enum CXXLinkType {
  STATIC,
  DYNAMIC,
  EXECUTABLE
}

export function validateSysroot(reporter: Reporter, path: AttributePath, value: any, target: CXXTarget) : CXXSysroot | undefined {
  let v = AttributeTypes.validateString(reporter, path, value);
  if (v !== undefined) {
    let m = v.match(/^([^:\s]+)(?::([^:\s]+)(?:@([^:\s]+))?)?$/);
    if (m) {
      let conditions = { platform: m[1], architecture: m[2], version: m[3] };
      let sysroot = CXXSysroots.validate(reporter, path, conditions);
      if (sysroot !== undefined)
        return new sysroot(target, conditions);
    }
    else {
      path.diagnostic(reporter, {
        type: "error",
        msg: `sysroot attribute format is invalid`,
        notes: [{ type: "note", msg: "valid format is 'platform[:architecture[:version]]'" }]
      });
    }
  }
  return undefined;
}

/**
 * Base target for C/C++ targets (library, framework, executable)
 * The sysroot is responsible of the build graph creation
*/
export abstract class CXXTarget extends Target {
  @resolver(validateSysroot)
  sysroot: CXXSysroot;

  @resolver(validateCompilerOptions)
  compilerOptions: CompilerOptions;

  @resolver(validateLinkerOptions)
  linkerOptions: LinkerOptions;

  @resolver(AttributeTypes.mapValidator<File, CompilerOptions, Target>(FileElement.validateFile, compilerExtensions))
  files: Map<File, CompilerOptions>;

  linkType: CXXLinkType;

  buildGraph(reporter: Reporter) {
    super.buildGraph(reporter);
    this.sysroot.buildGraph(reporter);
  }

  configure(reporter: Reporter, path: AttributePath) {
    super.configure(reporter, path);
  }
}
