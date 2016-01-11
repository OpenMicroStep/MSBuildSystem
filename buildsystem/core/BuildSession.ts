/// <reference path="../../typings/tsd.d.ts" />
/* @flow */
'use strict';

import fs = require("fs");
import path = require("path");
import _ = require('underscore');
var zlib = require('zlib');

/** Store information about the current build sessions (task informations) */
interface BuildSession {
  load(cb: ()=> void);
  save(cb: ()=> void);
  all() : { [s: string] : any };
  get(key: string) : any;
  set(key: string, info: any);
}

module BuildSession {
  var caches = {};
  var pendings= new Set<any>();
  var pendingsTimeoutDuration = 500;
  var pendingsTimeout = null;
  var pendingsTimeoutDelay = false;

  function onPendingsTimeout() {
    if (pendingsTimeoutDelay) {
      pendingsTimeoutDelay = false;
      pendingsTimeout = setTimeout(onPendingsTimeout, pendingsTimeoutDuration);
    }
    else {
      pendingsTimeout = null;
      savePendings();
    }
  }

  function savePendings() {
    console.info("Saving " + pendings.size);
    pendings.forEach((p) => {
      fs.writeFile(p, JSON.stringify(caches[p]), 'utf8');
    });
    pendings.clear();
  }
  process.on('exit', function() {
    if (pendings.size > 0) {
      console.info("Saving " + pendings.size);
      pendings.forEach((p) => {
        fs.writeFileSync(p, JSON.stringify(caches[p]), 'utf8');
      });
      pendings.clear();
      console.info("Saved");
    }
  });

  export class FastJSONDatabase implements BuildSession {
    protected path: string;
    protected data: any;
    constructor(path: string) {
      this.path = path;
      this.data = null;
    }

    load(cb: ()=> void) {
      this.data = caches[this.path];
      if (this.data) {
        cb();
        return;
      }

      fs.readFile(this.path, 'utf8', (err, data) => {
        try { this.data = JSON.parse(data); }
        catch(e) { this.data = {}; }
        caches[this.path] = this.data;
        cb();
      });
    }
    save(cb: ()=> void) {
      pendings.add(this.path);
      if (pendingsTimeout) {
        pendingsTimeoutDelay = true;
      } else {
        pendingsTimeout = setTimeout(onPendingsTimeout, pendingsTimeoutDuration);
      }
      cb();
    }
    all() : any {
      return this.data;
    }
    get(key: string) {
      return this.data[key];
    }
    set(key: string, info: any) {
      this.data[key] = info;
    }
  }
  export class InMemory implements BuildSession {
    protected data = {};

    load(cb: ()=> void) { cb(); }
    save(cb: ()=> void) { cb(); }
    all() : any {
      return this.data;
    }
    get(key: string) {
      return this.data[key];
    }
    set(key: string, info: any) {
      this.data[key] = info;
    }
  }
  export class Noop implements BuildSession {
    load(cb: ()=> void) { cb(); }
    save(cb: ()=> void) { cb(); }
    all() : any { return {}; }
    get(key: string) {
      return undefined;
    }
    set(key: string, info: any) {}
  }
  export var noop: BuildSession = new Noop();
}

export = BuildSession;
