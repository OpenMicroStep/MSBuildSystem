import * as path from 'path';
import * as fs from 'fs-extra';
import {util, Barrier, Flux, Reporter, AttributePath, AttributeTypes} from './index.priv';

export class File {
  public path: string;
  public name: string;
  public extension: string;
  public isDirectory: boolean;

  constructor(filePath: string, isDirectory = false) {
    this.path = filePath;
    this.name = path.basename(filePath);
    this.extension = path.extname(filePath);
    this.isDirectory = isDirectory;
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
    let commonPart: string[] | undefined;
    for (let i = 0, len = files.length; i < len; i++) {
      let file = files[i];
      let components = file.components();
      let componentsToConsider = file.isDirectory ? components.length : components.length - 1;
      if (!commonPart) {
        commonPart = components.slice(0, componentsToConsider);
      }
      else {
        let k = 0, klen = Math.min(commonPart.length, componentsToConsider);
        while (k < klen && commonPart[k] === components[k])
          k++;
        commonPart.length = k;
      }
    }
    return commonPart ? commonPart.join('/') : "";
  }

  static validateDirectory: AttributeTypes.Validator<Directory, { directory: string }>  = { 
    validate(reporter: Reporter, path: AttributePath, value: any, relative: { directory: string }) : Directory | undefined {
      if (typeof value === "string") {
        let v = AttributeTypes.validateString.validate(reporter, path, value);
        if (v !== undefined) {
          v = util.pathJoinIfRelative(relative.directory, v);
          return File.getShared(v, true);
        }
      }
      else {
        path.diagnostic(reporter, { is: "warning", msg: "attribute must be a relative path" });
      }
      return undefined;
    }
  };

  components() : string[] {
    return this.path.split(/[/\\]+/);
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
      else fs.writeFile(this.path, content, { encoding: "utf8" }, cb);
    });
  }
  ensureDir(cb: (err: Error) => void, parentEvenIfDirectory = false) {
    var dir = this.isDirectory && !parentEvenIfDirectory ? this.path : path.dirname(this.path);
    var ensure = File.ensureDirs.get(dir);
    if (!ensure)
      File.ensureDirs.set(dir, ensure = util.once((cb) => { fs.ensureDir(dir, cb); }));
    ensure(cb);
  }
  stats(cb: (err: Error, stats: fs.Stats) => void) {
    fs.stat(this.path, cb);
  }

  copyTo(to: File, lastSuccessStartTime: number, lastSuccessEndTime: number, cb: (err?: Error) => void) {
    this.stats((err, stats) => {
      if (err) return cb(err);
      to.stats((err, toStats) => {
        if (!err
         && stats.mtime.getTime() < lastSuccessStartTime
         && toStats.mtime.getTime() < lastSuccessEndTime
        )
         return cb();

        to.ensureDir((err) => {
          if (err) return cb(err);
          fs.copy(this.path, to.path, (err) => {
            if (err) return cb(err);
            fs.utimes(to.path, stats.atime.getTime() / 1000, stats.mtime.getTime() / 1000, cb);
          });
        });
      });
    });
  }

  writeSymlinkOf(step: Flux<{ reporter: Reporter }>, source: File, overwrite: boolean = false) {
    this.ensureDir((err) => {
      if (err) {
        step.context.reporter.error(err, { is: "error", msg: err.message, path: this.path });
        return step.continue();
      }
      fs.lstat(this.path, (err, stats) => {
        if (stats && !stats.isSymbolicLink()) {
          step.context.reporter.diagnostic({ is: "error", msg: "file already exists and is not a symbolic link", path: this.path });
          return step.continue();
        }

        let create = () => {
          fs.symlink(source.path, this.path, 'junction', (err) => {
            if (err && (<NodeJS.ErrnoException>err).code !== "EEXIST") step.context.reporter.error(err, { is: "error", msg: err.message, path: this.path });
            step.continue();
          });
        };

        if (stats) {
          fs.readlink(this.path, (err, currentTarget) => {
            if (err)
              step.context.reporter.error(err, { is: "error", msg: err.message, path: this.path });
            else if (!util.pathAreEquals(currentTarget, source.path)) {
              step.context.reporter.diagnostic({ is: "error", msg: `file already exists and is a symbolic link to '${currentTarget}'`, path: this.path });
              if (overwrite) {
                fs.unlink(this.path, (err) => {
                  if (err) {
                    step.context.reporter.error(err, { is: "error", msg: err.message, path: this.path });
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
    }, true);
  }

  unlink(step: Flux<{ reporter: Reporter }>) {
    fs.unlink(this.path, (err?) => {
      if (err && (<NodeJS.ErrnoException>err).code !== "ENOENT")
        step.context.reporter.error(err, { is: "error", msg: err.message, path: this.path });
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
