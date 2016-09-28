import {
  Target, File, Reporter,
  AttributePath, AttributeTypes, AttributeResolvers,
  resolver, FileElement
} from '@msbuildsystem/core';
import {CXXSysroot, CompileTask, LinkTask} from './index.priv';
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

export function validateSysroot(reporter: Reporter, path: AttributePath, value: any) : CXXSysroot | undefined {
  let v = AttributeTypes.validateString(reporter, path, value);
  if (v !== undefined) {
    let m = v.match(/^([^:\s]+)(?::([^:\s]+)(?:@([^:\s]+))?)?$/);
    if (m) {
      let conditions = { platform: m[1], architecture: m[2], version: m[3] };
      let sysroots = CXXSysroot.find(conditions);
      if (sysroots.length === 1)
        return new sysroots[0](conditions);
      else if (sysroots.length === 0)
        reporter.diagnostic({ type: "error", msg: `unable to find sysroot`});
      else
        reporter.diagnostic({ type: "error", msg: `multiple sysroots found`});
    }
    else
      reporter.diagnostic({ type: "error", msg: `sysroot attribute format is invalid`});
  }
  return undefined;
}

export type CompileFileParams = {language: string | undefined, compiler: string | undefined, compileFlags: string[]};

export type CXXTargetGraph = { compileTasks: CompileTask[], linkTasks: LinkTask[] };

/**
 * Base target for C/C++ targets (library, framework, executable)
 * The sysroot is responsible of the build graph creation
*/
export abstract class CXXTarget extends Target {
  @resolver(new SimpleResolver(validateSysroot))
  sysroot: CXXSysroot;

  @resolver(stringResolver)
  compiler: string | null = null;

  @resolver(stringResolver)
  linker: string | null = null;

  @resolver(stringSetResolver)
  includeDirectories: Set<string> = new Set();

  @resolver(new AttributeResolvers.MapResolver(FileElement.fileValidator, [
    { path: 'language', validator: validateString, default: undefined },
    { path: 'compiler', validator: validateString, default: undefined },
    { path: 'compileFlags', validator: validateStringList, default: [] }
  ]))
  files: Map<File, CompileFileParams>;

  @resolver(stringListResolver)
  defines: string[] = [];

  @resolver(stringListResolver)
  compileFlags: string[] = [];

  @resolver(stringListResolver)
  linkFlags: string[] = [];

  @resolver(stringListResolver)
  libraries: string[] = [];

  @resolver(stringListResolver)
  archives: string[] = [];

  @resolver(stringListResolver)
  frameworks: string[] = [];

  sysrootProvider;
  compilerProvider;

  linkType: CXXLinkType;

  configure(reporter: Reporter) {
    super.configure(reporter);
    if (this.sysroot)
      this.sysroot.target = this;
  }

  buildGraph(reporter: Reporter) : CXXTargetGraph {
    return this.sysroot.buildGraph(reporter);
  }
}
