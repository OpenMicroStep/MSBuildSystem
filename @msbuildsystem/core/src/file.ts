import * as path from 'path';
import * as fs from 'fs-extra';
import {util, Barrier} from './index.priv';

export class File {
  public path: string;
  public name: string;
  public extension: string;
  public isDirectory: boolean;
  private _stats?: (cb: (...args) => void) => void;

  constructor(filePath: string, isDirectory = false) {
    this.path = filePath;
    this.name = path.basename(filePath);
    this.extension = path.extname(filePath);
    this.isDirectory = isDirectory;
    this._stats = undefined;
  }

  private static files: Map<string, File> = new Map<any, any>();
  static getShared(filePath: string, isDirectory: true) : Directory;
  static getShared(filePath: string, isDirectory?: boolean) : File;
  static getShared(filePath: string, isDirectory = false) : File {
    var file = File.files.get(filePath);
    if (file) return file;
    filePath = path.normalize(filePath);
    if (!path.isAbsolute(filePath))
      throw new Error(`filepath must be absolute, got: '${filePath}'`);

    file = File.files.get(filePath);
    if (!file)
      File.files.set(filePath, file = new File(filePath, isDirectory));
    if (file.isDirectory !== isDirectory)
      throw new Error(`isDirectory usage is incoherant for file: '${filePath}'`);
    return file;
  }

  directory() : Directory {
    return <Directory>File.getShared(path.dirname(this.path), true);
  }

  static ensureDirs = new Map<string, (cb: (...args) => void) => void>();
  static clearCache() {
    File.files.forEach(function(file) {
      file._stats = undefined;
    });
    File.ensureDirs.clear();
  }

  /**
   * Ensure that outputs can be written
   * The callback is called with changed at 'true' if:
   *  - one of the inputs changed after what.time
   *  - one of the outputs changed after what.time
   */
  static ensure(
    files: File[],
    time: number,
    options: {ensureDir?: boolean; time?: number; parallel?: boolean},
    callback: (err: Error | undefined, changed: boolean) => any
  ) {
    var i = 0, len = files.length;
    var ensureDir = options.ensureDir || false;
    var parallel = options.parallel;
    var retErr = undefined;
    var retChanged = false;
    var barrier = new Barrier("ensure", files.length);
    if (parallel) {
      while (i < len)
        files[i++].ensure(ensureDir, time, dec);
    }
    else {
      next();
    }
    barrier.endWith(() => {
      callback(retErr, retChanged);
    });

    function next() {
      if (i < len) {
        let idx = i++;
        files[idx].ensure(ensureDir, time, dec);
      }
    }

    function dec(err, required) {
      if (err) retErr = err;
      if (required) retChanged = true;
      if (!ensureDir && (err || required))
        barrier.break();
      else {
        barrier.dec();
        if (!parallel) next();
      }
    };
  }

  ensure(ensureDir: boolean, time: number, callback: (err: Error | undefined, changed: boolean) => any) {
    if (this.isDirectory)
      return callback(undefined, false);
    this.stats((err, stats) => {
      if (err && ensureDir) {
          this.ensureDir(function(err) {
            callback(err, true);
          });
      } else if (err || stats.isFile()) {
        callback(err, !err && stats['mtime'].getTime() > time);
      } else {
        callback(err, false);
      }
    });
  }

  static buildList(root: string, ...args: Array<string | string[]>) {
    var files = <string[]>[];
    var len = args.length;
    var paths = new Array(len);

    function nextArg(i) {
      if (i < len) {
        var arg = args[i];
        if (typeof arg === "string") {
          paths[i] = arg;
          nextArg(i + 1);
        }
        else if (Array.isArray(arg)) {
          arg.forEach(function(arg) {
            paths[i] = arg;
            nextArg(i + 1);
          });
        }
        else {
          throw "arg must either be an array or a string";
        }
      } else {
        files.push(util.pathJoinIfRelative(root, path.join(...paths)));
      }
    }
    nextArg(0);

    return files;
  }

  static commonDirectory(files: File[]) : Directory {
    return <Directory>File.getShared(File.commonDirectoryPath(files), true);
  }
  static commonDirectoryPath(files: File[]) : string {
    var k, klen, i, len, file: File;
    var commonPart = "";
    for (i = 0, len = files.length; i < len; i++) {
      file = files[i];
      var dirPath = file.isDirectory ? file.path : path.dirname(file.path);
      if (!commonPart) {
        commonPart = dirPath;
      }
      else if (dirPath !== commonPart) {
        for (k = 0, klen = Math.min(dirPath.length, commonPart.length); k < klen && dirPath[k] === commonPart[k]; k++)
          ;
        commonPart = commonPart.substring(0, k);
      }
    }
    return commonPart;
  }

  readFile(cb: (err: Error, output: Buffer) => any) {
    fs.readFile(this.path, cb);
  }
  readUtf8File(cb: (err: Error, output: string) => any) {
    fs.readFile(this.path, "utf8", cb);
  }
  writeFile(content: Buffer, cb: (err: Error) => any) {
    fs.writeFile(this.path, content, cb);
  }
  writeUtf8File(content: string, cb: (err: Error) => any) {
    fs.writeFile(this.path, content, "utf8", cb);
  }
  ensureDir(cb: (err: Error) => void) {
    var dir = this.isDirectory ? this.path : path.dirname(this.path);
    var ensure = File.ensureDirs.get(dir);
    if (!ensure)
      File.ensureDirs.set(dir, ensure = util.once((cb) => { fs.ensureDir(dir, cb); }));
    ensure(cb);
  }
  stats(cb: (err: Error, stats: fs.Stats) => void) {
    if (!this._stats)
      this._stats = util.once((cb) => { fs.stat(this.path, cb); });
    this._stats(cb);
  }

  copyTo(to: File, lastSuccessTime: number, cb: (err?: Error) => void) {
    this.stats((err, stats) => {
      if (err) return cb(err);
      else if (stats.mtime.getTime() < lastSuccessTime) return cb();
      to.stats((err, toStats) => {
        if (!err && toStats.mtime.getTime() < lastSuccessTime) return cb();

        to.ensureDir((err) => {
          if (err) return cb(err);
          fs.copy(this.path, to.path, (err) => {
            if (err) return cb(err);
            fs.utimes(to.path, stats.atime.getTime(), stats.mtime.getTime(), cb);
          });
        });
      });
    });
  }

  unlink(cb: (err?: Error) => any) {
    fs.unlink(this.path, function(err?) {
      cb(err && (<NodeJS.ErrnoException>err).code !== "ENOENT" ? err : undefined);
    });
  }

  relativePath(basePath: string) : string {
    return path.relative(basePath, this.path);
  }
}

export interface Directory extends File {
  isDirectory: true;
}
