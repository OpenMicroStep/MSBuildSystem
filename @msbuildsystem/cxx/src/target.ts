import {
  Target, File, Reporter,
  AttributePath, AttributeTypes, AttributeResolvers,
  resolver, FileElement, Diagnostic
} from '@msbuildsystem/core';
import {CXXSysroot, sysrootClasses} from './index.priv';
const {validateString, validateStringList} = AttributeTypes;
const {SimpleResolver, stringResolver, stringListResolver, stringSetResolver} = AttributeResolvers;
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
      let sysroots = CXXSysroot.find(conditions);
      if (sysroots.length === 1)
        return new sysroots[0](target, conditions);
      else if (sysroots.length === 0)
        path.diagnostic(reporter, {
          type: "error",
          msg: `unable to find sysroot`,
          notes: [<Diagnostic>{ type: "note", msg: `while looking for sysroot: ${v}` }]
            .concat(sysrootClasses.map(s => (<Diagnostic>{
              type: "note",
              msg: `found: ${s.name}`
            })))
        });
      else
        path.diagnostic(reporter, {
          type: "error",
          msg: `multiple sysroots found`,
          notes: [<Diagnostic>{ type: "note", msg: `while looking for sysroot: ${v}` }]
            .concat(sysroots.map(s => (<Diagnostic>{
              type: "note",
              msg: `found: ${s.name}`
            })))
        });
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

export type CompileFileParams = {language: string | undefined, compiler: string | undefined, compileFlags: string[]};

/**
 * Base target for C/C++ targets (library, framework, executable)
 * The sysroot is responsible of the build graph creation
*/
export abstract class CXXTarget extends Target {
  @resolver(validateSysroot)
  sysroot: CXXSysroot;

  @resolver(AttributeTypes.validateString)
  compiler: string | null = null;

  @resolver(AttributeTypes.validateString)
  linker: string | null = null;

  @resolver(AttributeTypes.validateStringSet)
  includeDirectories: Set<string> = new Set();

  @resolver(AttributeTypes.mapValidator(FileElement.validateFile, [
    { path: 'language', validator: validateString, default: undefined },
    { path: 'compiler', validator: validateString, default: undefined },
    { path: 'compileFlags', validator: validateStringList, default: [] }
  ]))
  files: Map<File, CompileFileParams>;

  @resolver(AttributeTypes.validateStringList)
  defines: string[] = [];

  @resolver(AttributeTypes.validateStringList)
  compileFlags: string[] = [];

  @resolver(AttributeTypes.validateStringList)
  linkFlags: string[] = [];

  @resolver(AttributeTypes.validateStringList)
  libraries: string[] = [];

  @resolver(AttributeTypes.validateStringList)
  archives: string[] = [];

  @resolver(AttributeTypes.validateStringList)
  frameworks: string[] = [];

  sysrootProvider;
  compilerProvider;

  linkType: CXXLinkType;

  buildGraph(reporter: Reporter) {
    this.sysroot.buildGraph(reporter);
  }
}
