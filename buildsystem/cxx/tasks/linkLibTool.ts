import {Task, declareTask, Graph, File} from '../../core'
import {LinkTask} from './link';
import {CompileTask} from './compile';
import {CXXTarget, CXXLinkType} from '../cxxTarget';

@declareTask({ type: "link-libtool" })
class LinkLibToolTask extends LinkTask {
  constructor(graph: Graph, compileTasks: CompileTask[], finalFile: File, type: CXXLinkType, provider?) {
    provider = provider || (type === CXXLinkType.STATIC ? {linker:"libtool"} : { compiler: "clang"});
    super(graph, compileTasks, finalFile, type, provider);
    if(this.type === CXXLinkType.STATIC) {
      this.appendArgs(["-static", "-o", [finalFile]]);
    }
    else {
      if(this.type === CXXLinkType.DYNAMIC)
        this.appendArgs(["-shared"]);
      this.appendArgs(["-o", [finalFile]]);
    }
    this.appendArgs(this.inputFiles.map(function (file) {
      return file.path;
    }));
  }
  addFlags(libs: string[]) {
    this.insertArgs(3, libs);
  }

  addLibraryFlags(libs: string[]) {
    if(this.type !== CXXLinkType.STATIC)
      this.appendArgs(libs);
  }

  addArchiveFlags(libs: string[]) {
    if(this.type !== CXXLinkType.STATIC) {
      libs.forEach((lib) => {
        this.appendArgs(["-force_load", lib]);
      });
    }
  }
}
