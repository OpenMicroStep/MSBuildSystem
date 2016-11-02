import * as priv from './index.priv';priv;
export {CXXTarget, CXXLinkType, CXXSourceExtensions} from './target';
export {CXXSysroot, CXXSysroots} from './sysroot';

export {CXXBundle} from './targets/bundle';
export {CXXExecutable} from './targets/executable';
export {CXXFramework} from './targets/framework';
export {CXXLibrary} from './targets/library';

export {CXXDarwinSysroot} from './sysroots/darwin';
//export {CXXLinuxSysroot} from './sysroots/linux';
//export {CXXWindowsSysroot} from './sysroots/windows';

export {CompileTask} from './tasks/compile';
export {CompileClangTask} from './tasks/compileClang';
export {CompileGCCTask} from './tasks/compileGCC';
export {CompileMasmTask} from './tasks/compileMasm';

export {LinkTask} from './tasks/link';
export {LinkLibToolTask} from './tasks/linkLibTool';
//export {LinkBinUtilsTask} from './tasks/linkBinUtils';
//export {LinkMSCVTask} from './tasks/linkMSVC';

export {LipoTask} from './tasks/lipo';
