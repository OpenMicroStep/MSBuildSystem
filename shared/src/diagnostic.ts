
export interface Diagnostic {
  is: "note" | "remark" | "warning" | "error" | "fatal error";
  msg: string;
  path?: string;
  row?: number;
  col?: number;
  option?: string;
  category?: string;
  ranges?: Diagnostic.Range[];
  notes?: Diagnostic[];
  fixits?: Diagnostic.Fixit[];
}
export module Diagnostic {
  export type Fixit = {
    range: Range,
    path: string,
    replacement: string
  };
  export type Range = {
    srow: number;
    scol: number;
    erow: number;
    ecol: number;
  };

  const RX_STACK = /^\s*at(?:\s+(.+))?\s+\(?([^:]+):(\d+):(\d+)\)?$/;
  export function fromError(error: Error, base?: Diagnostic) {
    if (!base) {
      base = {
        is: "fatal error",
        msg: error.message
      };
    }
    var stack = error.stack;
    if (stack) {
      var lines = stack.split("\n");
      var notes: Diagnostic[] = [];
      for (var i = 0, len = lines.length; i < len; i++) {
        var line = lines[i];
        var m = line.match(RX_STACK);
        if (m) {
          notes.push({
            is: "note",
            msg: m[1]  || "anonymous",
            path: m[2],
            row: parseInt(m[3]),
            col: parseInt(m[4])
          });
        }
      }
      base.notes = notes;
    }
    return base;
  }
}
