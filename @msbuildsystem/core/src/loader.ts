import * as fs from 'fs';
import * as path from 'path';
require('source-map-support').install();


export namespace Loader {
  export function isTestModule(moduleName: string) {
    return moduleName.endsWith("tests");
  }
  export class Module {
    constructor(public path: string, public name: string, public exports: any) {}
  }

  export const modules = new Map<string, Module>();

  export function loadModules(at?: string, filter: (moduleName: string, path: string) => boolean = (n) => !Loader.isTestModule(n)) {
    at = at || path.join(__dirname, '../'); // parent folder (aka @msbuildsystem folder)
    var dir = fs.readdirSync(at);
    dir.forEach(function(moduleName) {
      try {
        let p = path.join(at, moduleName);
        if (fs.statSync(p).isDirectory()) {
          if (moduleName !== 'cli' && (!filter || filter(moduleName, p))) {
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
