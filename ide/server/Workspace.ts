/// <reference path="../../typings/tsd.d.ts" />
'use strict';

import path = require('path');
import BuildSystem = require('../../buildsystem/BuildSystem');
import WorkspaceFile = require('./WorkspaceFile');
import replication = require('./replication');

class Workspace extends replication.ServedObject<BuildSystem.Workspace> {
  constructor(directory: string) {
    super(new BuildSystem.Workspace(directory));
  }

  openFile(filepath: string) : Promise<WorkspaceFile> {
    return WorkspaceFile.getShared(path.isAbsolute(filepath) ? filepath : path.join(this.obj.directory, filepath));
  }
  data() : any {
    return {
      files: this.obj.files,
      path: this.obj.path,
    };
  }
}

export = Workspace;
