import {Task, declareTask, Graph, Barrier, File, Step} from '../../core'
import * as fs from 'fs-extra';
import {basename} from 'path';

export module Plist {
  export function stringify(what) {
    var out = "";
    var lvl = 0;

    function indent() {
      for(var i = 0; i< lvl; ++i)
        out += "  ";
    }
    function encode(what) {
      if(typeof what === "string") {
        out += JSON.stringify(what); // TODO: create a real encoder for this
      }
      else if(Array.isArray(what)) {
        out += "(";
        for(var i = 0, len = what.length; i < len; ++i) {
          if(i > 0)
            out += ", ";
          encode(what[i]);
        }
        out += ")";
      }
      else {
        out += "{\n";
        ++lvl;
        for(var k in what) {
          if(what.hasOwnProperty(k)) {
            indent();
            encode(k);
            out += "=";
            encode(what[k]);
            out += ";\n"
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

@declareTask({ type: "plistinfo" })
export class PlistInfoTask extends Task {
  constructor(graph: Graph, public info: {[s: string]: any}, public path: string) {
    super({ type: "plistinfo", name: basename(path) }, graph);
  }

  uniqueKey(): string {
    return JSON.stringify({info: this.info, path: this.path});
  }
  isRunRequired(step: Step) {
    File.getShared(this.path).ensure(true, step.lastSuccessTime, (err, required) => {
      step.context.runRequired = !!(err || required);
      step.continue();
    });
  }
  run(step) {
    fs.writeFile(this.path, Plist.stringify(this.info), 'utf8', (err) => {
      if(err) step.error(err.toString());
      step.continue();
    });
  }
  clean(step) {
    fs.unlink(this.path, (err) => {
      if(err && (<NodeJS.ErrnoException>err).code === "ENOENT")
        err = null;
      if (err)
        step.error(err);
      step.continue();
    });
  }
}
