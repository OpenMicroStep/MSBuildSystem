import * as fs from 'fs';
import * as path from 'path';
import {Flux, Test} from './index.priv';
require('source-map-support').install();


export namespace Loader {
  export function isTestModule(moduleName: string) {
    return moduleName.endsWith("tests");
  }
  export class Module {
    testModule: Test<any> | undefined = undefined;
    constructor(public path: string, public name: string, public exports: any) {}

    test(): Test<any> {
      if (this.testModule === undefined) {
        this.testModule = { name: this.name, tests: [] };
        try {
          Object.assign(this.testModule, require(`${this.path}.tests`));
        } catch (e) {}
      }
      return this.testModule || { name: this.name, tests: [] };
    }
  }

  export const modules = new Map<string, Module>();

  export function testModules(flux: Flux<any>) {
    let test = { name: "@msbuildsystem", tests: Array.from(modules.values()).map(m => m.test()) };
    Test.run(flux, test);
  }

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
