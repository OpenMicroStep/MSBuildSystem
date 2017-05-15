import {File, Graph, ProviderConditions} from '@openmicrostep/msbuildsystem.core';
import {CompileTask} from '../index.priv';

//              1:path  2:row         3:type     4:msg
var rxdiag  = /^([^:]+)[\(:](\d+)\)?: (warning:)?(.+?)$/;

class CompileWO451Task extends CompileTask {
  constructor(graph: Graph, srcFile:File, objFile:File, provider: ProviderConditions = { compiler: "gcc" }) {
    super(graph, srcFile, objFile, provider);
    /*
    if(options.variant === "release")
      this.appendArgs("-O3");
    if(options.variant === "debug")
      this.appendArgs("-g");
    */
    this.appendArgs([
      "-o", [objFile],
      "-c", [srcFile],
    ]);
  }
  addHeaderMapArgs(objFile: File) {
    //this.appendArgs(["-H"]);
  }

  parseHeaderMap(step) {
    //console.info("parse header map", step.context.output);
    step.continue();
  }

  parseLogs(logs) {
    var diag;
    var diags = [];
    var lines = logs.split(/[\r\n]+/);
    for (var i = 0, len = lines.length; i < len; ++i) {
      var line = lines[i];
      var matches = line.match(rxdiag);
      if (matches) {
        var d = {
          type: matches[3] ? "warning" : "error",
          path: matches[1],
          row: parseInt(matches[2]),
          col: 1,
          ranges: [],
          msg: matches[4].trim(),
          option: "",
          category: "",
          notes: [],
          fixits: [],
        };
        if (d.type === "note" && diag)
          diag.notes.push(d);
        else {
          diags.push(d);
          diag = d;
        }
      }
    }
    return diags;
  }
}
