/// <reference path="../../typings/tsd.d.ts" />
/* @flow */
'use strict';

import fs = require("fs");
import path = require("path");
import util = require('./util');
var zlib = require('zlib');

/** Store information about the current build sessions (task informations) */
interface BuildSession {
  retrieveInfo(taskid: string, key: string) : any;
  storeInfo(taskid: string, key: string, info: any);
}
module BuildSession {
  export class FastJSONDatabase implements BuildSession {
    protected olds: { [s:string] : any };
    protected news: { [s:string] : any };
    constructor(public dbPath: string) {
      this.news = {};
      this.olds = {};
    }
    loadData(callback: () => void) {
      var t0 = util.timeElapsed('load data');
      fs.readFile(this.dbPath, (err, data) => {
        if (!err && data) {
          try {
            this.olds = JSON.parse(zlib.gunzipSync(data));
            t0();
          } catch(e) {}
        }
        callback();
      });
    }
    saveData(callback: () => void) {
      var t0 = t0 = util.timeElapsed('save data');
      fs.writeFile(this.dbPath, zlib.gzipSync(new Buffer(JSON.stringify(this.news, null, 2), 'utf8')), () => {
        t0();
        callback();
      });
    }
    retrieveInfo(taskid: string, key: string) {
      var ret = this.news[taskid];
      if (!ret) {
        ret = this.olds[taskid];
        if (ret) this.news[taskid] = ret;
        else ret = {};
      }
      return ret[key];
    }
    storeInfo(taskid: string, key: string, info: any) {
      var o = this.news[taskid];
      if (!o) {
        o = {};
        this.news[taskid] = o;
      }
      o[key] = info;
    }
  }
  export class InMemory implements BuildSession {
    protected infos = new Map<string, any>();
    retrieveInfo(taskid: string, key: string) {
      return this.infos.get(taskid + '-' + key);
    }
    storeInfo(taskid: string, key: string, info: any) {
      this.infos.set(taskid + '-' + key, info);
    }
  }
  export class Noop implements BuildSession {
    retrieveInfo(taskid: string, key: string) {
      return undefined;
    }
    storeInfo(taskid: string, key: string, info: any) {}
  }
  export var noop: BuildSession = new Noop();
}

export = BuildSession;
