import * as fs from 'fs';

/** Store information about the current build sessions (task informations) */
export interface BuildSession {
  load(cb: () => void);
  save(cb: () => void);
  all() : { [s: string]: any };
  get(key: string) : any;
  set(key: string, info: any);
}

var caches = {};

export class FastJSONDatabase implements BuildSession {
  protected path: string;
  protected data: any;
  constructor(path: string) {
    this.path = path;
    this.data = null;
  }

  load(cb: () => void) {
    this.data = caches[this.path];
    if (this.data) {
      cb();
      return;
    }

    fs.readFile(this.path, 'utf8', (err, data) => {
      try { this.data = JSON.parse(data); }
      catch (e) { this.data = {}; }
      caches[this.path] = this.data;
      cb();
    });
  }
  save(cb: () => void) {
    fs.writeFile(this.path, JSON.stringify(this.data), { encoding: 'utf8' }, cb);
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

  load(cb: () => void) { cb(); }
  save(cb: () => void) { cb(); }
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
  load(cb: () => void) { cb(); }
  save(cb: () => void) { cb(); }
  all() : any { return {}; }
  get(key: string) {
    return undefined;
  }
  set(key: string, info: any) {}
}
export var noop: BuildSession = new Noop();
