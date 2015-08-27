/// <reference path="../../typings/tsd.d.ts" />
'use strict';

import path = require('path');
import replication = require('./replication');
import File = require('../../buildsystem/core/File');

class WorkspaceFile extends replication.ServedObject<File> {
  constructor(path: string) {
    super(File.getShared(path));
  }
  content: string;
  version: number;
  deltas: any[];

  data() : any {
    return {
      path:this.obj.path,
      name:this.obj.name,
      extension:this.obj.extension,
      content:this.content,
      deltas: this.deltas,
      version:this.version,
    };
  }

  change(version: number, data) : boolean {
    var ok = this.version + 1 == version;
    if (ok) {
      this.version = version;
      this.deltas.push(data);
      this.broadcast("change", version, data);
    }
    return ok;
  }

  save(content: string) : Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.obj.writeUtf8File(content, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  private static files: { [s: string]: WorkspaceFile } = {};
  static getShared(filePath): Promise<WorkspaceFile> {
    filePath = path.normalize(filePath);
    if(!path.isAbsolute(filePath))
      throw "'filePath' must be absolute (filePath=" + filePath + ")";

    var file = WorkspaceFile.files[filePath];
    if(!file) {
      file = WorkspaceFile.files[filePath] = new WorkspaceFile(filePath);
      return new Promise(function (resolve, reject) {
        file.obj.readUtf8File(function (err, content) {
          if (err) return reject(err);

          file.content = content;
          file.version = 0;
          file.deltas = [];
          resolve(file);
        })
      });
    }
    else {
      return new Promise(function (resolve) {
        resolve(file);
      });
    }
  }
}

export = WorkspaceFile;
