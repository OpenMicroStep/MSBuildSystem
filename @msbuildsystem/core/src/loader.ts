import * as fs from 'fs';
import * as path from 'path';
declare function describe(name: string, tests: any);
require('source-map-support').install();

export namespace Loader {
  export class Module {
    constructor(public path: string, public name: string, public exports: any) {}

    test() {
      try {
        var pkg = JSON.parse(fs.readFileSync(path.join(this.path, 'package.json')).toString('utf8'));
        if (typeof pkg.test !== 'string')
          throw "no test";
        let tests = require(path.join(this.path, pkg.test)).tests;
        describe(this.name, tests);
      } catch (e) {
        console.info("No test found for " + this.name);
      }
    }
  }

  export var modules = new Map<string, Module>();
  export function loadModules(at?: string, filter?: (moduleName: string, path: string) => boolean) {
    at = at || path.join(__dirname, '../'); // parent folder (aka @msbuildsystem folder)
    var dir = fs.readdirSync(at);
    dir.forEach(function(moduleName) {
      try {
        let p = path.join(at, moduleName);
        if (fs.statSync(p).isDirectory()) {
          if (!filter || filter(moduleName, p)) {
            modules.set(moduleName, new Module(p, moduleName, require(p)));
          }
        }
      } catch (e) {
        if (e.code !== "MODULE_NOT_FOUND")
          console.error("Unable to load module", moduleName, e);
      }
    });
  }
}
