import * as path from 'path';
import * as fs from 'fs-extra';
import {util, Barrier, Flux, Reporter, AttributePath, AttributeTypes} from './index.priv';

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
    if (this.isDirectory) {
      if (ensureDir)
        this.directory().ensureDir((err) => { callback(err, true); });
      else
        callback(undefined, false);
      return;
    }

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

  static validateDirectory(reporter: Reporter, path: AttributePath, value: any, relative: { directory: string }) : Directory | undefined {
    if (typeof value === "string") {
      let v = AttributeTypes.validateString(reporter, path, value);
      if (v !== undefined) {
        v = util.pathJoinIfRelative(relative.directory, v);
        return File.getShared(v, true);
      }
    }
    else {
      path.diagnostic(reporter, { type: "warning", msg: "attribute must be a relative path" });
    }
    return undefined;
  }

  readFile(cb: (err: Error, output: Buffer) => any) {
    fs.readFile(this.path, cb);
  }
  readUtf8File(cb: (err: Error, output: string) => any) {
    fs.readFile(this.path, "utf8", cb);
  }
  writeFile(content: Buffer, cb: (err: Error) => any) {
    this.ensureDir((err) => {
      if (err) cb(err);
      else fs.writeFile(this.path, content, cb);
    });
  }
  writeUtf8File(content: string, cb: (err: Error) => any) {
    this.ensureDir((err) => {
      if (err) cb(err);
      else fs.writeFile(this.path, content, "utf8", cb);
    });
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

  writeSymlinkOf(step: Flux<{ reporter: Reporter }>, target: File, overwrite: boolean = false) {
    fs.lstat(this.path, (err, stats) => {
      if (stats && !stats.isSymbolicLink()) {
        step.context.reporter.diagnostic({ type: "error", msg: "file already exists and is not a symbolic link", path: this.path });
        return step.continue();
      }

      let create = () => {
        fs.symlink(target.path, this.path, undefined, (err) => {
          if (err && (<NodeJS.ErrnoException>err).code !== "EEXIST") step.context.reporter.error(err, { type: "error", msg: err.message, path: this.path });
          step.continue();
        });
      };

      if (stats) {
        fs.readlink(this.path, (err, currentTarget) => {
          if (err)
            step.context.reporter.error(err, { type: "error", msg: err.message, path: this.path });
          else if (currentTarget !== target.path) {
            step.context.reporter.diagnostic({ type: "error", msg: `file already exists and is a symbolic link to '${currentTarget}'`, path: this.path });
            if (overwrite) {
              fs.unlink(this.path, (err) => {
                if (err) {
                  step.context.reporter.error(err, { type: "error", msg: err.message, path: this.path });
                  return step.continue();
                }
                create();
              });
              return;
            }
          }
          step.continue();
        });
      }
      else {
        create();
      }
    });
  }

  unlink(step: Flux<{ reporter: Reporter }>) {
    fs.unlink(this.path, (err?) => {
      if (err && (<NodeJS.ErrnoException>err).code !== "ENOENT")
        step.context.reporter.error(err, { type: "error", msg: err.message, path: this.path });
      step.continue();
    });
  }

  relativePath(basePath: string) : string {
    return path.relative(basePath, this.path);
  }
}

export interface Directory extends File {
  isDirectory: true;
}
