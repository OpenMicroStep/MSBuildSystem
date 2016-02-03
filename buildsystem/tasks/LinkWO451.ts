import CompileTask = require('./Compile');
import File = require('../core/File');
import Task = require('../core/Task');
import LinkTask = require('./Link');
import Graph = require('../core/Graph');
import Provider = require('../core/Provider');
import CXXTarget = require('../targets/_CXXTarget');
import path = require('path');
import fs = require('fs');

var rxline = /(SECT\d+)(.+?)External\s+\|\s+_?(.+)$/;

var providers: any = {};
providers[CXXTarget.LinkType.STATIC] = { archiver:"msvc" , version: "wo451"};
providers[CXXTarget.LinkType.DYNAMIC] =  { linker: "msvc", version: "wo451" };
providers[CXXTarget.LinkType.EXECUTABLE] = { compiler: "gcc", version: "wo451" };

class LinkWO451Task extends LinkTask {
  index: number;
  constructor(graph: Graph, compileTasks: CompileTask[], finalFile: File, type: CXXTarget.LinkType) {
    super(graph, compileTasks, finalFile, type, providers[type]);
    if(this.type === CXXTarget.LinkType.STATIC) {
      this.appendArgs(["/out:" + finalFile.path]);
    }
    else if(this.type === CXXTarget.LinkType.DYNAMIC) {
      var def = File.getShared(finalFile.path.substring(0, finalFile.path.length - 3) + "def");
      this.outputFiles.push(def);
      this.appendArgs(["-def", def.path, "-dynamic"]);

      var lib = File.getShared(finalFile.path.substring(0, finalFile.path.length - 3) + "lib");
      this.outputFiles.push(lib);
      this.appendArgs(["-o", finalFile.path]);
    }
    else if(this.type === CXXTarget.LinkType.EXECUTABLE) {
      this.appendArgs(["-win", "-arch", "i386-nextpdo-winnt3.5"]);
      this.appendArgs(["-o", finalFile.path]);
    }
    this.index = this.args.length;
    this.appendArgs(this.inputFiles.map(function (file) {
      return file.path;
    }));
  }

  addFlags(libs: string[]) {
    this.insertArgs(this.index, libs);
  }

  runProcess(step, provider) {
    if (this.type !== CXXTarget.LinkType.DYNAMIC)
      return super.runProcess(step, provider);
    step.setFirstElements([
      (step) => {
        provider.process(step, this.inputFiles, [], "run", {
          args: ["-dump", "-symbols"].concat(this.inputFiles.map((file) => { return file.path; })),
          env: this.env
        }, {
          requires: [Provider.require.inputs],
          task: this
        });
      },
      (step) => {
        step.error(step.context.err);
        if (step.errors > 0) return step.continue();
        var output = step.context.output;
        var def = "LIBRARY " + this.outputFiles[0].name + "\r\nEXPORTS\r\n";
        var lines = output.split(/[\r\n]+/);
        lines.forEach((line: string) => {
          var matches = line.match(rxline);
          if (matches && line.indexOf("__GLOBAL") === -1 && line.indexOf("_OBJC_") === -1) {
            if (matches[1] === "SECT2" || matches[3].indexOf(".objc_c") !== -1) {
              def += "\t" + matches[3] + " CONSTANT\r\n";
            }
            else if (matches[1] === "SECT1" || matches[1] === "SECT6") {
              def += "\t" + matches[3] + "\r\n";
            }
          }
        });
        fs.writeFile(this.outputFiles[1].path, def, 'utf8', (err) => {
          step.error(err);
          step.continue();
        });
      },
      (step) => {
        var provider = Provider.find({ linker: "libtool", version: "wo451" });
        if(!provider) step.error("'provider' not found");
        if (step.errors > 0) return step.continue();

        provider.process(step, this.inputFiles, this.outputFiles, "run", {
          args: this.args,
          env: this.env
        }, {
          requires: this.providerRequires(),
          task: this
        });
      },
      (step) => {
        if (step.errors > 0) return step.continue();
        step.log(step.context.output);
        step.error(step.context.err);
        step.continue();
      }
    ]);
    step.continue();
  }

  private _addLibFlags(libs: string[], isArchive: boolean) {
    if(this.type !== CXXTarget.LinkType.STATIC)
      this.addFlags(libs.map((lib) => {
        if (lib[0] == '-' && lib[1] == 'l')
          lib= lib.substring(2) + ".lib";
        if(path.extname(lib) == ".dll") {
          lib = lib.substring(0, lib.length - 3) + "lib";}
        if (path.isAbsolute(lib)) {
          var f = File.getShared(lib);
          this.inputFiles.push(f);
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
    if(this.type === CXXTarget.LinkType.STATIC)
      return;
    var f = File.getShared(def);
    this.inputFiles.push(f);
    this.addFlags(["/def:"+def]);
  }
  addDefs(defs: string[]) {
    defs.forEach((def) => {
      this.addDef(def);
    });
  }
}
Task.registerClass(LinkWO451Task, "LinkWO451");

export = LinkWO451Task;
