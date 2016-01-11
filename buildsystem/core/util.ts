/// <reference path="../../typings/tsd.d.ts" />
/* @flow weak */
'use strict';

import fs = require('fs');
import path = require('path');

export function requireDir(dirPath: string): {[s: string]: any} {
  var dir = fs.readdirSync(dirPath);
  var modules:{[s: string]: any} = {};
  dir.forEach(function(modulePath) {
    if(path.extname(modulePath) === '.js' && modulePath[0] !== "_") {
      modulePath = modulePath.substring(0, modulePath.length - 3);
      modules[modulePath] = require(path.join(dirPath, modulePath));
    }
  });
  return modules;
}

export function timeElapsed(title: string, action: () => void) : number;
export function timeElapsed(action: () => void) : number;
export function timeElapsed(title: string) : () => number;
export function timeElapsed() : () => number;
export function timeElapsed(a0?, a1?) : any {
  var title = typeof a0 === "string" ? a0 : null;
  var action = a1 || (typeof a0 === "function" && a0);
  if (action) {
    var t = timeElapsed(title);
    action();
    return t();
  }

  var t0 = process.hrtime();
  return function() {
    var diff = process.hrtime(t0);
    var ns = diff[0] * 1e9 + diff[1];
    if (title)
      console.info(title + " in %d ms", (ns / 1e6).toFixed(2));
    return ns;
  }
}

export function nodepromise(action: (cb: (err, value?) => void) => void) {
  return new Promise(function(res, rej) {
    action(function(err, value) {
      if (err) rej(err);
      else res(value);
    });
  });
}