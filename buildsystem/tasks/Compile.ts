import ProcessTask = require('./_Process');
import File = require('../core/File');
import Task = require('../core/Task');
import Graph = require('../core/Graph');
import Provider = require('../core/Provider');
import Barrier = require('../core/Barrier');
import Process = require('../core/Process');

//              1:path  2:row 3:col    4:ranges                      5:type                       6:msg     7:option     8:category
var rxdiag  = /^([^:]+):(\d+):(\d+):(?:((?:\{\d+:\d+-\d+:\d+\})+):)? (warning|error|note|remark): (.+?)(?:\[([^,\]]+)(?:,([^\]]+))?\])?$/;
//                     1:path       2-5:range                   6:replacement
var rxfixit = /^fix-it:"([^"]+)":\{(\d+):(\d+)-(\d+):(\d+)\}:"([^"]+)"$/;

class CompileTask extends ProcessTask {
  public language: string;
  hmapFile: File;
  constructor(graph: Graph, srcFile : File, objFile : File, provider: Provider.Conditions ) {
    super({type: "compile", name: srcFile.name}, graph, [srcFile], [objFile], provider);
    this.language = CompileTask.extensions[srcFile.extension];
    this.hmapFile = File.getShared(objFile.path + ".hmap");
    this.outputFiles.push(this.hmapFile);
    this.addHeaderMapArgs();
  }

  static extensions =  {
    '.m' : 'OBJC',
    '.c' : 'C',
    '.mm' : 'OBJCXX',
    '.cc' : 'CXX',
    '.cpp' : 'CXX',
    '.s' : 'ASM',
    '.S' : 'ASM',
    '.asm' : 'ASM'
  };
  addHeaderMapArgs() {
    this.appendArgs(["-MMD", "-MF", this.hmapFile.path]);
  }

  parseHeaderMap(cb: () => any) {
    this.hmapFile.readUtf8File((err, content) => {
      if(err) return cb();
      var headers = [];
      var lines = content.split("\n");
      for(var i = 1, len = lines.length; i <len; ++i) {
        var header = lines[i];
        if(header.endsWith("\\"))
          header = header.substring(0, header.length - 1).trim();
        else
          header = header.trim();
        if(header.length)
          headers.push(header);
      }
      this.sharedData.headers = headers;
      cb();
    })
  }

  parseRanges(ranges: string) {
    if (!ranges) return [];
    return ranges.split('}{').map(function(range) {
      var m = range.match(/(\d+):(\d+)-(\d+):(\d+)/);
      return {srow:parseInt(m[1]), scol:parseInt(m[2]), erow:parseInt(m[3]), ecol:parseInt(m[4])};
    });
  }

  parseLogs(logs) {
    var diag;
    var diags = [];
    var lines = logs.split("\n");
    for(var i = 0, len= lines.length; i < len; ++i) {
      var line = lines[i];
      var matches = line.match(rxdiag);
      if (matches) {
        var d = {
          type: matches[5],
          path: matches[1],
          row: parseInt(matches[2]),
          col: parseInt(matches[3]),
          ranges: this.parseRanges(matches[4]),
          msg: matches[6].trim(),
          option: matches[7],
          category: matches[8],
          notes: [],
          fixits: [],
        }
        if (d.type === "note" && diag)
          diag.notes.push(d);
        else {
          diags.push(d);
          diag = d;
        }
      }
      else if (diag && (matches = line.match(rxfixit))) {
        var fixit = {
          path: matches[1],
          replacement: matches[6],
          range: {srow:parseInt(matches[2]), scol:parseInt(matches[3]), erow:parseInt(matches[4]), ecol:parseInt(matches[5])}
        };
        diag.fixits.push(fixit);
      }
    }
    return diags;
  }

  runProcess(provider, callback) {
    super.runProcess(provider, (err, output) => {
      this.data.diagnostics = output ? this.parseLogs(output) : [];
      this.parseHeaderMap(() => {
        callback(err, output);
      });
    });
  }

  isRunRequired(callback: (err: Error, required?:boolean) => any) {
    var barrier = new File.EnsureBarrier("Compile.isRunRequired", 3);
    if(this.sharedData.headers)
      File.ensure(this.sharedData.headers, this.data.lastSuccessTime, {}, (err, required) => { barrier.dec(null, !!err || required) });
    else
      barrier.dec(null, true);
    File.ensure(this.inputFiles, this.data.lastSuccessTime, {}, barrier.decCallback());
    File.ensure(this.outputFiles, this.data.lastSuccessTime, {ensureDir: true}, barrier.decCallback());
    barrier.endWith(callback);
  }
}
Task.registerClass(CompileTask, "Compile");

export = CompileTask;