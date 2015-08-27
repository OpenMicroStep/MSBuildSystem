/// <reference path="../../typings/browser.d.ts" />
/* @flow */
'use strict';

import replication = require('./replication');
import WorkspaceFile = require('./WorkspaceFile');

class Workspace extends replication.DistantObject {
  path: string;
  files;
  targets;
  openFiles = {};

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
    var p, o = this.openFiles[path];
    if (!o) {
      o = {promise: p= this.remoteCall("openFile", path) };
      this.openFiles[path] = o;
      p.then(function(res) {
        delete o.promise;
        o.obj = res;
      })
    }
    else if (o.promise) {
      p = o.promise;
    }
    else {
      p = new Promise(function(resolve) {
        resolve(o.obj);
      });
    }

    return p;
  }
}
replication.registerClass("Workspace", WorkspaceFile);

export = Workspace;

