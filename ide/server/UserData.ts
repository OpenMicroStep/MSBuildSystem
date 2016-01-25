var path = require('path');
var fs = require('fs-extra');
var AppDirectory = require('appdirectory');
var dirs = new AppDirectory('MicroStep IDE');
var userDataPath = dirs.userData();

class UserData {
  protected path: string;
  protected data: any;
  constructor(name: string) {
    this.path = path.join(userDataPath, name);
    this.data = null;
  }

  load(p) {
    fs.readFile(this.path, 'utf8', (err, data) => {
      try { this.data = JSON.parse(data); }
      catch(e) { this.data = {}; }
      p.continue();
    });
  }
  save(p) {
    fs.ensureFile(this.path, (err) => {
      fs.writeFile(this.path, JSON.stringify(this.data), 'utf8', (err) => {
        p.continue();
      });
    });
  }
  all() : any {
    return this.data;
  }
  get(key: string, defaultValue?) {
    var v= this.data[key];
    if (v === void 0 && defaultValue !== void 0) {
      this.set(key, defaultValue);
      v = defaultValue;
    }
    return v;
  }
  set(key: string, info: any) {
    this.data[key] = info;
  }
}

export = UserData;