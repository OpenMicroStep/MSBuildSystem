import Graph = require('../core/Graph');
import Sysroot = require('../core/Sysroot');
import File = require('../core/File');
import Provider = require('../core/Provider');
import CXXTarget = require('../targets/_CXXTarget');
import CompileWO451Task = require('../tasks/CompileWO451');
import LinkWO451Task = require('../tasks/LinkWO451');
import CompileTask = require('../tasks/Compile');
import CopyTask = require('../tasks/Copy');
import path = require('path');

class WO451Sysroot extends Sysroot {
  triple:string;
  prefix:string;
  sysrootDirectory:string;

  constructor(directory:string, extension:{}) {
    super(directory, extension);
    this.sysrootDirectory = this.sysrootDirectory || this.directory;
    this.prefix = this.prefix || ("bin/" + (this.triple || ""));
  }

  createCompileTask(target: CXXTarget, srcFile: File, objFile: File, callback: Sysroot.CreateTaskCallback) {
    var task = new CompileWO451Task(target, srcFile, objFile, { compiler: "gcc", version: "wo451" });
    task.addFlags(["-DWO451", "-DWIN32"]);
    callback(null, task);
  }
  createLinkTask(target: CXXTarget, compileTasks: CompileTask[], finalFile: File, callback: Sysroot.CreateTaskCallback) {
    var link = new LinkWO451Task(target, compileTasks, finalFile, target.linkType);
    //link.llvmLinkProvider = <Provider.Process>Provider.find({type:"llvm-link", version:"3.7"});
    //link.clangLinkProvider = <Provider.Process>Provider.find({compiler:"clang", version:"3.7"});
    //link.clangLinkArgs.push("--target=" + this.triple);
    callback(null, link);
  }
  linkFinalName(target: CXXTarget):string {
    var name = super.linkFinalName(target);
    switch(target.linkType) {
      case CXXTarget.LinkType.EXECUTABLE: name += ".exe"; break;
      case CXXTarget.LinkType.DYNAMIC:    name += ".dll"; break;
      case CXXTarget.LinkType.STATIC:     name += ".lib"; break;
    }
    return name;
  }
  linkFinalPath(target: CXXTarget):string {
    if(target.isInstanceOf("Bundle"))
      return super.linkFinalPath(target);
    // No rpath, soname, install_name in windows
    // The only thing that could mimic this is the "Manifest SxS" system that no one seems to understand correctly :(
    return path.join(target.outputBasePath, target.env.directories.target["Executable"], this.linkFinalName(target));
  }
  configure(target: CXXTarget, callback: ErrCallback) {
    target.env.linker = "wo451";
    target.env.compiler = "gcc";
    callback();
  }
}

WO451Sysroot.prototype.platform = "win32";

export = WO451Sysroot;
