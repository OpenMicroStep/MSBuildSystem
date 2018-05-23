import * as util from './util';
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
  export const stats = {
    moduleCount: 0,
    moduleLoadCost: 0,
    providerCount: 0,
    providerLoadCost: 0,
  };

  export function loadModules(at?: string, filter: (moduleName: string, path: string) => boolean = (n) => !Loader.isTestModule(n)) {
    let t0 = util.now();
    at = at || path.join(__dirname, '../'); // parent folder (aka @msbuildsystem folder)
    var dir = fs.readdirSync(at);
    dir.forEach(function(moduleName) {
      try {
        let p = path.join(at!, moduleName);
        if (fs.statSync(p).isDirectory()) {
          if (moduleName !== 'cli' && (!filter || filter(moduleName, p))) {
            modules.set(moduleName, new Module(p, moduleName, require(p)));
            stats.moduleCount += 1;
          }
        }
      } catch (e) {
        if (e.code !== "MODULE_NOT_FOUND")
          console.error("Unable to load module", moduleName, e);
      }
    });
    let cost = util.now() - t0;
    stats.moduleLoadCost += cost;
  }

  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  export function safeLoadIfOutOfDate<T>({ name, uuid, init, load } : { 
    name: string,
    uuid: string,
    init: () => T | undefined,
    load: (data: T) => void,
  }) {
    if (!isUUID.test(uuid))
      throw new Error(`safeLoadIfOutOfDate expect uuid to be a real UUID`);
    let data: T | undefined = undefined;
    let t0 = util.now();
    try {
      data = init();
      JSON.stringify(data); // ensure data can be serialized
      // TODO: cache data somewhere
    } catch (e) {}
    if (data)
      load(data);
    let cost = util.now() - t0;
    stats.providerCount += 1;
    stats.providerLoadCost += cost;
  }
}
