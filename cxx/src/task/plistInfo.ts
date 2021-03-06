import {Graph, GenerateFileTask, File} from '@openmicrostep/msbuildsystem.core';

export module Plist {
  export function stringify(what) {
    var out = "";
    var lvl = 0;

    function indent() {
      for (var i = 0; i < lvl; ++i)
        out += "  ";
    }
    function encode(what) {
      if (typeof what === "string") {
        out += JSON.stringify(what); // TODO: create a real encoder for this
      }
      else if (Array.isArray(what)) {
        out += "(";
        for (var i = 0, len = what.length; i < len; ++i) {
          if (i > 0)
            out += ", ";
          encode(what[i]);
        }
        out += ")";
      }
      else {
        out += "{\n";
        ++lvl;
        for (var k in what) {
          if (what.hasOwnProperty(k)) {
            indent();
            encode(k);
            out += "=";
            encode(what[k]);
            out += ";\n";
          }
        }
        --lvl;
        out += "}\n";
      }
    }
    encode(what);
    return out;
  }
}

export class PlistInfoTask extends GenerateFileTask {
  constructor(graph: Graph, public info: {[s: string]: any}, path: File) {
    super({ type: "plistinfo", name: path.name }, graph, path);
  }

  uniqueKeyInfo() : any {
    return this.info;
  }
  generate() : Buffer {
    return new Buffer(Plist.stringify(this.info), 'utf8');
  }
}
