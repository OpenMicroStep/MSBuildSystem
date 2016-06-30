import {
  Target, Task, Graph, File, Workspace, Step, Reporter, skipStepIfFailed,
  TargetAttributes, AttributeTypes, AttributeResolvers, ProviderAttributeValue, providerLookup,
  declareResolvers
} from '../core';
import {CXXSysroot} from './cxxSysroot';
import {CompileTask} from './tasks/compile';
import {LinkTask} from './tasks/link';
import Barrier = require('../core/Barrier');
import * as util from 'util';
import * as path from 'path';

export var CXXSourceExtensions =  {
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

/** Base target for C/C++ targets (library, framework, executable) */
@declareResolvers([
  new AttributeResolvers.SimpleResolver({ path: "arch"   , defaultValue: null }),
  new AttributeResolvers.SimpleResolver({ path: "sysroot", defaultValue: null }),
  new AttributeResolvers.TaskListResolver({ path: "files"             , exportable: true }),
  new AttributeResolvers.TaskListResolver({ path: "includeDirectories", exportable: true }),
  new AttributeResolvers.ListResolver({
    path: "publicHeaders",
    map: AttributeTypes.validateString,
    extensions: [
      {path:"dest"  , map: AttributeTypes.validateString , default: ""   }, 
      {path:"expand", map: AttributeTypes.validateBoolean, default: false}
    ],
    exportable: true
  }),
  new AttributeResolvers.TaskListResolver({ path: "defines"     , exportable: true }),
  new AttributeResolvers.TaskListResolver({ path: "compileFlags", exportable: true }),
  new AttributeResolvers.TaskListResolver({ path: "linkFlags"   , exportable: true }),
  new AttributeResolvers.TaskListResolver({ path: "libraries"   , exportable: true }),
  new AttributeResolvers.TaskListResolver({ path: "archives"    , exportable: true }),
  new AttributeResolvers.TaskListResolver({ path: "frameworks"  , exportable: true }),
])
export abstract class CXXTarget extends Target {
  arch: string;
  sysroot: string;
  sysrootVersion: string;
  platform: string;
  compiler: string;
  compilerVersion: string;
  files: Set<File>;
  compileTasks: CompileTask[];
  linkTask: LinkTask;
  includeDirectories: Set<string>;
  publicHeaders: Map<File, {dest: string, expand: boolean}>;

  sysrootProvider;
  compilerProvider;

  linkType: CXXLinkType;

  configure(reporter: Reporter) {
    this.sysrootProvider = this.configureProviderLookup(reporter, { type: "sysroot" }, { 
      arch: this.attributes.arch,
      sysroot: this.attributes.sysroot, 
      platform: this.attributes.platform 
    });
    this.arch = this.sysrootProvider && this.sysrootProvider.arch;
    this.sysroot = this.sysrootProvider && this.sysrootProvider.sysroot;
    this.sysrootVersion = this.sysrootProvider && this.sysrootProvider.sysrootVersion;
    this.platform = this.sysrootProvider && this.sysrootProvider.platform;
    
    this.compilerProvider = this.configureProviderLookup(reporter, { type: "compiler" }, this.attributes.compiler);
    this.compiler = this.compilerProvider && this.compilerProvider.compiler;
    this.compilerVersion = this.compilerProvider && this.compilerProvider.compilerVersion;
      
    this.files = this.configureResolveFiles(this.attributes.files);
  }

  buildGraph(reporter: Reporter) {
    this.buildCompileGraph(reporter);
    this.buildLinkGraph(reporter);
  }
  
  configureCompileTask(reporter: Reporter, task: CompileTask) {
    var includeDirectories = this.configureIncludeDirectories()
    this.configureTask(reporter, task);
  }
  
  configureLinkTask(reporter: Reporter, task: LinkTask) {
    this.configureTask(reporter, task);
  }
  
  buildCompileGraph(reporter: Reporter) {
    this.compileTasks = [];
    this.files.forEach((srcFile) => {
      if (isCXXSourceFile(srcFile)) {
        var relativePath = path.relative(this.workspace.directory, srcFile.path + ".o");
        var objFile = File.getShared(path.join(this.paths.intermediates, relativePath));
        var task = this.sysrootProvider.createCompileTask(reporter, this, srcFile, objFile);
        if (task) {
          this.compileTasks.push(task);
          this.configureCompileTask(reporter, task);
        }
      }
    });
  }
  
  buildLinkGraph(reporter: Reporter) {
    var finalFile = File.getShared(this.sysrootProvider.linkFinalPath(this));
    this.linkTask = this.sysrootProvider.createLinkTask(reporter, this, this.compileTasks, finalFile);
    if (this.linkTask) {
      this.configureLinkTask(reporter, this.linkTask);
    }
  }
}
