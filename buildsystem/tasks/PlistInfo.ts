/// <reference path="../../typings/tsd.d.ts" />
/* @flow weak */
'use strict';

import Task = require('../core/Task');
import Graph = require('../core/Graph');
import Barrier = require('../core/Barrier');
import File = require('../core/File');
import fs = require('fs-extra');
var basename = require('path').basename;

class Plist {
  static stringify(what) {
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

class PlistInfoTask extends Task {
  constructor(graph: Graph, public info: {[s: string]: any}, public path: string) {
    super({ type: "plistinfo", name: basename(path) }, graph);
  }

  uniqueKey(): string {
    return JSON.stringify({info: this.info, path: this.path});
  }
  isRunRequired(callback: (err: Error, required?:boolean) => any) {
    File.ensure([this.path], this.data.lastSuccessTime, {ensureDir:true}, callback);
  }
  run() {
    fs.writeFile(this.path, Plist.stringify(this.info), 'utf8', (err) => {
      if(err) this.log(err.toString());
      this.end(err ? 1 : 0);
    });
  }
  clean() {
    fs.unlink(this.path, function(err) {
      if(err && (<NodeJS.ErrnoException>err).code === "ENOENT")
        err = null;
      this.end(err ? 1 : 0);
    });
  }
}
Task.registerClass(PlistInfoTask, "PlistInfo");


export = PlistInfoTask;
