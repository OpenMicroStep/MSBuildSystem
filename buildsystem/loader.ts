import * as fs from 'fs';
import * as path from 'path';

require('source-map-support').install();

export var modules = new Map<string, any>();
export function loadModules() {
  var dir = fs.readdirSync(__dirname);
  dir.forEach(function(moduleName) {
    try {
      var p = path.join(__dirname, moduleName, "index.js");
      if (fs.statSync(p).isFile()) {
        try {
          let module = require(p);
          modules.set(moduleName, module);
        } catch(e) {
          console.error("Unable to load module", moduleName, e);
        }
      }
    } catch(e) {}
  });
}