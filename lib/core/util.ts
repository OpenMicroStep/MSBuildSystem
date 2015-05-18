/// <reference path="../../typings/tsd.d.ts" />
/* @flow weak */
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