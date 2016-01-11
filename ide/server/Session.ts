/// <reference path="../../typings/tsd.d.ts" />
import replication = require('./replication');
import WorkspaceFile = require('./WorkspaceFile');
import Workspace = require('./Workspace');
class Session extends replication.ServedObject<any> {
  constructor(socket: SocketIO.Socket) {
    super(null);
  }

  openFile(pool, filepath: string) {
    WorkspaceFile.getShared(pool, filepath);
  }

  openWorkspace(pool, path: string) {
    pool.context.response = Workspace.getShared(path);
    pool.continue();
  }
}

export = Session;