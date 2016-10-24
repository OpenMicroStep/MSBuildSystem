import {File, declareTask, Step, Graph, Diagnostic, StepWithData, ProviderConditions} from '@msbuildsystem/core';
import {ProcessTask} from '@msbuildsystem/foundation';

//              1:path  2:row 3:col    4:ranges                      5:type                                  6:msg     7:option     8:category
var rxdiag  = /^([^:]+):(\d+):(\d+):(?:((?:\{\d+:\d+-\d+:\d+\})+):)? (warning|(?:fatal )?error|note|remark): (.+?)(?:\[([^,\]]+)(?:,([^\]]+))?\])?$/;
//                     1:path       2-5:range                   6:replacement
var rxfixit = /^fix-it:"([^"]+)":\{(\d+):(\d+)-(\d+):(\d+)\}:"([^"]+)"$/;

@declareTask({ type: "cxxcompile" })
export class CompileTask extends ProcessTask {
  hmapFile: File;
  constructor(graph: Graph, srcFile: File, objFile: File, provider: ProviderConditions) {
    super({type: "cxxcompile", name: srcFile.name}, graph, [srcFile], [objFile], provider);
    this.addHeaderMapArgs(objFile);
  }

  addHeaderMapArgs(objFile: File) {
    this.hmapFile = File.getShared(objFile.path + ".hmap");
    this.outputFiles.push(this.hmapFile);
    this.appendArgs(["-MMD", "-MF", [this.hmapFile]]);
  }

  addOptions(options: any) {
    if (options.includeSearchPath) {
      options.includeSearchPath.forEach((dir) => {
        var d = File.getShared(dir, true);
        this.inputFiles.push(d);
        this.addFlags([['-I', d]]);
      });
    }
    if (options.frameworkPath) {
      options.frameworkPath.forEach((dir) => {
        var d = File.getShared(dir, true);
        this.inputFiles.push(d);
        this.addFlags([['-F', d]]);
      });
    }
  }

  parseHeaderMap(step: StepWithData<{}, {}, { headers?: string[] }>) {
    this.hmapFile.readUtf8File((err, content) => {
      if (err) { step.context.reporter.error(err); }
      else {
        var headers = <string[]>[];
        var lines = content.split("\n");
        for (var i = 1, len = lines.length; i < len; ++i) {
          var header = lines[i];
          if (header.endsWith("\\"))
            header = header.substring(0, header.length - 1).trim();
          else
            header = header.trim();
          if (header.length)
            headers.push(header);
        }
        step.context.sharedData.headers = headers;
      }
      step.continue();
    });
  }

  parseRanges(ranges: string) : Diagnostic.Range[] {
    var ret = <Diagnostic.Range[]>[];
    if (ranges) {
      var rngs = ranges.split('}{');
      for (var range of rngs) {
        var m = range.match(/(\d+):(\d+)-(\d+):(\d+)/);
        if (m) {
          ret.push({
            srow: parseInt(m[1]), scol: parseInt(m[2]),
            erow: parseInt(m[3]), ecol: parseInt(m[4])
          });
        }
      }
    }
    return ret;
  }

  parseLogs(logs: string) : Diagnostic[] {
    var diag: Diagnostic | null = null;
    var diags: Diagnostic[] = [];
    var lines = logs.split(/[\r\n]+/);
    for (var i = 0, len = lines.length; i < len; ++i) {
      var line = lines[i];
      var matches = line.match(rxdiag);
      if (matches) {
        var d = {
          type: <any>matches[5],
          path: matches[1],
          row: parseInt(matches[2]),
          col: parseInt(matches[3]),
          ranges: this.parseRanges(matches[4]),
          msg: matches[6].trim(),
          option: matches[7],
          category: matches[8],
          notes: [],
          fixits: [],
        };
        if (d.type === "note" && diag)
          diag.notes!.push(d);
        else {
          diags.push(d);
          diag = d;
        }
      }
      else if (diag && (matches = line.match(rxfixit))) {
        var fixit = {
          path: matches[1],
          replacement: matches[6],
          range: {
            srow: parseInt(matches[2]), scol: parseInt(matches[3]),
            erow: parseInt(matches[4]), ecol: parseInt(matches[5])
          }
        };
        diag.fixits!.push(fixit);
      }
    }
    return diags;
  }

  runProcess(step: Step<{ output?: string, err?: any }>, provider) {
    step.setFirstElements((step) => {
      var output = step.context.output;
      step.context.reporter.diagnostics = output ? this.parseLogs(output) : [];
      this.parseHeaderMap(step);
    });
    super.runProcess(step, provider);
  }

  providerRequires() {
    return ["inputs", "files", "dependencies outputs"];
  }

  isRunRequired(step: StepWithData<{ runRequired?: boolean }, {}, { headers: string[] }>) {
     step.setFirstElements((step) => {
       if (!step.context.runRequired && step.context.sharedData.headers) {
         File.ensure(step.context.sharedData.headers.map(h => File.getShared(h)), step.context.lastSuccessTime, {}, (err, required) => {
           step.context.runRequired = !!(err || required);
           step.continue();
         });
       }
       else {
         step.continue();
       }
     });
     super.isRunRequired(step);
  }
}
