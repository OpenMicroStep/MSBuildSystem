/// <reference path="../../typings/browser.d.ts" />
/* @flow */
'use strict';

import replication = require('./replication');
import WorkspaceFile = require('./WorkspaceFile');

class Workspace extends replication.DistantObject {
  path: string;
  files;
  targets;
  openFiles: { [s: string]: Promise<WorkspaceFile> } = {};

  outofsync() {
    return new Promise((resolve, reject) => {
      replication.socket.emit('rootWorkspace', (workspace: replication.DistantObjectProtocol) => {
        this.changeId(workspace.id);
        this.initWithData(workspace.data);
        resolve();
      });
    });
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
}
replication.registerClass("Workspace", WorkspaceFile);

export = Workspace;

