/// <reference path="../../typings/tsd.d.ts" />
/* @flow */
'use strict';

import fs = require('fs-extra');
import path = require('path');
import util = require('util');
import Barrier = require('./Barrier');


// Nodejs basename && extname are quite slow (use complex regexp)
// Theses replacements returns the same values but are about 100 times faster
path.basename = function(path: string) : string {
  var idx = path.length, c;
  while (idx > 1 && (c= path[--idx]) !== '/' && c !== '\\');
  return idx > 0 ? path.substring(idx + 1) : path;
}
path.extname = function(path: string) : string {
  var idx = path.length, c;
  while (idx > 1 && (c= path[--idx]) !== '.' && c !== '/' && c !== '\\');
  return idx > 0 && c === '.' ? path.substring(idx) : '';
}

class LocalFile {
  public path:string;
  public name:string;
  public extension:string;
  private _stats = null;

  constructor(filePath:string) {
    this.path = filePath;
    this.name = path.basename(filePath);
    this.extension = path.extname(filePath);
  }

  private static files: Map<string, LocalFile> = new Map<any, any>();
  static getShared(filePath: string): LocalFile {
    var file = LocalFile.files.get(filePath);
    if (file) return file;
    filePath = path.normalize(filePath);
    if(!path.isAbsolute(filePath))
      throw "'filePath' must be absolute (filePath=" + filePath + ")";

    file = LocalFile.files.get(filePath);
    if(!file)
      LocalFile.files.set(filePath, file= new LocalFile(filePath));
    return file;
  }

  /**
   * Ensure that outputs can be written
   * The callback is called with changed at 'true' if:
   *  - one of the inputs changed after what.time
   *  - one of the outputs changed after what.time
   */
  static ensure(files: (string | LocalFile)[], time: number, options: {ensureDir?:boolean;}, callback: (err: Error, changed?:boolean) => any) {
    var barrier = new LocalFile.EnsureBarrier("File ensure", files.length);
    files.forEach(function(file) {
      var sharedFile: LocalFile;
      sharedFile = (typeof file === "string") ? LocalFile.getShared(file) : file;
      sharedFile.stat(function(err, stats) {
        if(err && options.ensureDir) {
            fs.ensureDir(path.dirname(sharedFile.path), function(err) {
              barrier.dec(err, true);
            });
        } else {
          barrier.dec(err, !err && stats['mtime'].getTime() > time);
        }
      });
    });
    barrier.endWith(callback);
  }

  static buildList(root: string, ...args: Array<string | string[]>) {
    var files = [];
    var len = args.length;
    var paths = new Array(len);

    function nextArg(i) {
      if(i < len) {
        var arg = args[i];
        if(typeof arg === "string") {
          paths[i] = arg;
          nextArg(i + 1);
        }
        else if(Array.isArray(arg)) {
          arg.forEach(function(arg) {
            paths[i] = arg;
            nextArg(i + 1);
          });
        }
        else {
          throw "arg must either be an array or a string";
        }
      } else {
        var p = path.join.apply(null, paths);
        if (!path.isAbsolute(p))
          p = path.join(root, p);
        files.push(p);
      }
    }
    nextArg(0);

    return files;
  }

  readFile(cb: (err: Error, output: Buffer) => any) {
    fs.readFile(this.path, cb);
  }
  readUtf8File(cb: (err: Error, output: string) => any) {
    fs.readFile(this.path, "utf8", cb);
  }
  writeUtf8File(content: string, cb: (err: Error) => any) {
    fs.writeFile(this.path, content, "utf8", cb);
  }
  stat(cb : (err: Error, stats: fs.Stats) => any) {
    fs.stat(this.path, cb);
  }
  unlink(cb : (err: Error) => any) {
    fs.unlink(this.path, function(err) {
      if(err && (<NodeJS.ErrnoException>err).code === "ENOENT")
        err = null;
      cb(err);
    });
  }
}

module LocalFile {

  export class EnsureBarrier extends Barrier {
    protected err = null;
    protected required = false;
    dec(err?: any, required?: boolean) {
      if((err || required) && this.counter > 0) {
        this.err = err;
        this.required = required;
      }
      super.dec();
    }
    decCallback() {
      return (err?: any, required?: boolean) => { this.dec(err, required); }
    }
    protected signal(action) {
      action(this.err, this.required);
    }
    endWith(action: (err?, required?: boolean) => any) {
      super.endWith(action);
    }
  }

}

export = LocalFile;
