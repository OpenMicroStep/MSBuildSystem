import {Graph, File, ProviderConditions} from '@openmicrostep/msbuildsystem.core';
import {CXXLinkType, LinkTask, CompileTask, CXXBundle, CXXExecutable} from '../index.priv';
import * as path from 'path';

class LinkMSVCTask extends LinkTask {
  public dumpbinProvider: ProviderConditions;
  public exports: File[];
  commands: File;

  constructor(graph: Graph, compileTasks: CompileTask[], finalFile: File, type: CXXLinkType, provider?: ProviderConditions, dumpbinProvider?: ProviderConditions) {
    provider = provider || (type === CXXLinkType.STATIC ? {archiver: "msvc"} : { linker: "msvc"});
    super(graph, compileTasks, finalFile, type, provider);
    this.dumpbinProvider = dumpbinProvider || { custom: "dumpbin" };
    this.exports = [];
    this.dumpbinProvider = null;
    if (this.type === CXXLinkType.STATIC) {
      this.appendArgs([["/out:", finalFile]]);
    }
    else {
      var target = this.target();
      this.commands = File.getShared(path.join(this.target().paths.intermediates, finalFile.name + ".commands"));
      this.appendArgs(["kernel32.lib", "user32.lib", "shell32.lib", "MSVCRT.lib", "oldnames.lib"]);
      this.appendArgs(["/nologo"]);
      this.appendArgs(["/subsystem:CONSOLE,5.01"]);
      //if (target.variant !== "release")
      this.appendArgs(["/debug"]);
      if (this.type === CXXLinkType.DYNAMIC) {
        this.appendArgs(["/dll"]);
        if (!(target instanceof CXXBundle) && !(target instanceof CXXExecutable)) {
          var out = File.getShared(finalFile.path.substring(0, finalFile.path.length - 3) + "lib");
          this.exports.push(out);
          this.outputFiles.push(out);
        }
      }
      //if (target.variant !== "release")
      this.outputFiles.push(File.getShared(finalFile.path.substring(0, finalFile.path.length - 3) + "pdb"));
      this.appendArgs([["/out:", finalFile]]);
    }
    this.appendArgs(this.inputFiles.map(function (file) {
      return [file];
    }));
    if (this.commands)
      this.inputFiles.push(this.commands);
  }
  addFlags(libs) {
    this.insertArgs(2, libs);
  }

  runProcess(step, provider) {
    step.setFirstElements([
      (step) => {
        if (!this.commands) return step.continue();
        var args = this.flattenArgs(provider).map((arg) => { return '"' + arg + '"'; }).join('\n');
        this.commands.writeUtf8File(args, (err) => {
          step.error(err);
          step.continue();
        });
      },
      (step) => {
        provider.process(step, this.inputFiles, this.outputFiles, "run", {
          args: this.commands ? this.flattenArgs(provider, [["@", this.commands]]) : this.flattenArgs(provider),
          env: this.env
        }, {
          requires: this.providerRequires(),
          task: this
        });
      },
      (step) => {
        step.log(step.context.output);
        step.error(step.context.err);
        step.continue();
      },
      (step) => {
        if (!step.context.err && false && this.type === CXXLinkType.DYNAMIC) {
          // TODO
          var args = ["/EXPORTS"];
          this.exports.forEach((file) => { args.push(file.path); });
          var dumpbin = Provider.find(this.dumpbinProvider);
          dumpbin.process(step, this.exports, [], "runTask", {
            args: ["/EXPORTS", ],
          }, {});
        }
        else {
          step.continue();
        }
      }
    ]);
    step.continue();
  }

  private _addLibFlags(libs: string[], isArchive: boolean) {
    if (this.type !== CXXLinkType.STATIC)
      this.addFlags(libs.map((lib) => {
        if (lib[0] === '-' && lib[1] === 'l')
          lib = lib.substring(2) + ".lib";
        if (path.extname(lib) === ".dll") {
          lib = lib.substring(0, lib.length - 3) + "lib"; }
        if (path.isAbsolute(lib)) {
          var f = File.getShared(lib);
          if (isArchive)
            this.exports.push(f);
          this.inputFiles.push(f);
          lib = <any>[f];
        }
        return lib;
      }));
  }
  addLibraryFlags(libs: string[]) {
    this._addLibFlags(libs, false);
  }

  addArchiveFlags(libs: string[]) {
    this._addLibFlags(libs, true);
  }
  addDef(def: string) {
    if (this.type === CXXLinkType.STATIC)
      return;
    var f = File.getShared(def);
    this.inputFiles.push(f);
    this.addFlags([["/def:", f]]);
  }
  addDefs(defs: string[]) {
    defs.forEach((def) => {
      this.addDef(def);
    });
  }
}
