export * from './target';
export * from './sysroot';

export * from './tasks/compile';
export * from './tasks/compileClang';
export * from './tasks/compileGCC';
export * from './tasks/compileMasm';

export * from './tasks/link';
export * from './tasks/linkLibTool';
//export {LinkBinUtilsTask} from './tasks/linkBinUtils';
//export {LinkMSCVTask} from './tasks/linkMSVC';

export * from './tasks/headerAlias';
export * from './tasks/plistInfo';
export * from './tasks/lipo';

export * from './targets/executable';
export * from './targets/library';
export * from './targets/framework';
export * from './targets/bundle';

export * from './sysroots/darwin';
//export {CXXLinuxSysroot} from './sysroots/linux';
//export {CXXWindowsSysroot} from './sysroots/windows';
export * from './sysroots/detect';

