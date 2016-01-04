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

  change(p, e) {
    if (e && Array.isArray(e.deltas)) {
      this.deltas.push(...e.deltas);
      this.version += e.deltas.length;
      this.broadcastToOthers(p.context.socket, "extchange", { version: this.version, deltas:e.deltas });
      p.context.response = { version: this.version };
    }
    p.continue();
  }

  save(p, content: string) {
    var version = ++this.version;
    this.content = content;
    this.deltas = [];
    this.obj.writeUtf8File(content, (err) => {
      if (!err) {
        this.broadcastToOthers(p.context.socket, "extsaved", { version: version, content: content });
        p.context.response = { version: version };
      }
      p.context.error = err;
      p.continue();
    });
  }

  private static files: Map<string, WorkspaceFile> = new Map<any, any>();
  static getShared(pool, filePath) {
    filePath = path.normalize(filePath);
    if(!path.isAbsolute(filePath))
      throw "'filePath' must be absolute (filePath=" + filePath + ")";

    var file = WorkspaceFile.files.get(filePath);
    if(!file) {
      WorkspaceFile.files.set(filePath, file = new WorkspaceFile(filePath));
      file.obj.readUtf8File(function (err, content) {
        if (err) pool.context.error = err;
        else {
          file.content = content;
          file.version = 0;
          file.deltas = [];
          pool.context.response = file;
        }
        pool.continue();
      });
    }
    else {
      pool.context.response = file;
      pool.continue();
    }
  }
}

export = WorkspaceFile;
