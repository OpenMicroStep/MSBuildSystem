/// <reference path="../../typings/browser.d.ts" />
/* @flow */
'use strict';

import replication = require('./replication');
import WorkspaceFile = require('./WorkspaceFile');

class Graph extends replication.DistantObject {
  workspace: Workspace;
}

class Workspace extends replication.DistantObject {
  path: string;
  name: string;
  files;
  targets;
  openFiles: { [s: string]: Promise<WorkspaceFile> } = {};

  constructor() {
    super();
    this.on('reload', (e) => {
      this.name = e.name;
      this.path = e.path;
      this.files = e.files;
    });
    this.on('graph', (e) => {
      console.log("graph", e);
    });
  }
  outofsync() {
    return new Promise((resolve, reject) => {
      replication.socket.emit('rootWorkspace', (workspace: replication.DistantObjectProtocol) => {
        this.changeId(workspace.id);
        resolve();
      });
    });
  }

  reload() : Promise<void> {
    return this.remoteCall("reload");
  }

  openFile(path) : Promise<WorkspaceFile> {
    var ret = this.openFiles[path];
    if (!ret) {
      ret = this.remoteCall("openFile", path);
      ret.then((res) => {
          res.workspace = this;
      });
      this.openFiles[path] = ret;
    }
    return ret;
  }

  buildGraph(options: any) : Promise<Graph> {
    return this.remoteCall("buildGraph", options);
  }
}
replication.registerClass("Workspace", WorkspaceFile);

export = Workspace;

