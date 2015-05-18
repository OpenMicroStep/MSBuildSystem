/// <reference path="../../typings/tsd.d.ts" />
/* @flow */
import fs = require('fs-extra');
import path = require('path');
import util = require('util');
import Barrier = require('./Barrier');

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

  private static files: { [s: string]: LocalFile } = {};
  static getShared(filePath): LocalFile {
    filePath = path.normalize(filePath);
    if(!path.isAbsolute(filePath))
      throw "'filePath' must be absolute (filePath=" + filePath + ")";

    var file = LocalFile.files[filePath];
    if(!file)
      file = LocalFile.files[filePath] = new LocalFile(filePath);
    return file;
  }

  static ensure(what : {inputs: LocalFile[]; outputs: LocalFile[]}, callback: (err: Error, changed?:boolean) => any) {
    var mtimeInput = 0;
    var mtimeOutput = -1;
    var barrier = new Barrier.FirstErrBarrier("File ensure", what.inputs.length + what.outputs.length);

    what.inputs.forEach(function(input) {
      input.stat(function(err, stats) {
        if(err) {
          barrier.dec(err);
        }
        else {
          mtimeInput = Math.max(stats['mtime'].getTime(), mtimeInput);
          barrier.dec();
        }
      });
    });

    what.outputs.forEach(function(output) {
      output.stat(function(err, stats) {
        if(err) {
          fs.ensureDir(path.dirname(output.path), function(err) {
            barrier.dec(err);
          });
        }
        else {
          mtimeOutput = Math.min(stats['mtime'].getTime(), mtimeInput);
          barrier.dec();
        }
      });
    });

    barrier.endWith(function(err) {
      if(err) return callback(err);
      callback(null, true); //mtimeInput > mtimeOutput);
    });
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

  stat(cb : (err: Error, stats: fs.Stats) => any) {
    if(this._stats) return cb(null, this._stats);
    var self = this;
    fs.stat(this.path, function(err, stats) {
      if(!err)
        self._stats = stats;
      cb(err, stats);
    });
  }
  unlink(cb : (err: Error) => any) {
    fs.unlink(this.path, function(err) {
      if(err && (<NodeJS.ErrnoException>err).code === "ENOENT")
        err = null;
      cb(err);
    });
  }
}

export = LocalFile;
