/// <reference path="../../typings/tsd.d.ts" />
'use strict';

import path = require('path');
import BuildSystem = require('../../buildsystem/BuildSystem');
import WorkspaceFile = require('./WorkspaceFile');
import replication = require('./replication');

function taskData(task: BuildSystem.Task) {
  if (!task) return null;
  var data: any = task.data || {};
  var ret = {
    id: task.id(),
    name: task.name,
    logs: data.logs,
    errors: data.errors,
    lastRunStartTime: data.lastRunStartTime,
    lastRunEndTime: data.lastRunEndTime,
    lastSuccessTime: data.lastSuccessTime,
    tasks: []
  }
  if (task instanceof BuildSystem.Graph) {
     ret.tasks= [];
     task.allTasks().forEach((t) => {
       ret.tasks.push(taskData(t));
     });
  }
  return ret;
}

class Workspace extends replication.ServedObject<BuildSystem.Workspace> {
  options: any;
  buildGraph: Promise<any>;

  constructor(directory: string) {
    super(new BuildSystem.Workspace(directory));
    this.options = {
      environments: ['openmicrostep-core-x86_64-darwin']
    };
    this._reload();
  }

  openFile(filepath: string) : Promise<WorkspaceFile> {
    return WorkspaceFile.getShared(path.isAbsolute(filepath) ? filepath : path.join(this.obj.directory, filepath));
  }


  addListener(socket) {
    setTimeout(() => {
      this.emit(socket, "reload", this._reloaddata());
      this.buildGraph.then((r) => { this.emit(socket, "graph", r); });
    }, 0);
  }

  reload() : Promise<void> {
    this.obj.reload();
    this.broadcast("reload", this._reloaddata());
    this._reload();
    this.buildGraph.then((r) => { this.broadcast("graph", r); });
    return Promise.resolve();
  }

  _reload() {
    this.buildGraph = new Promise((resolve) => {
      this.obj.buildGraph(this.options)
        .then((r) => { resolve({graph: taskData(r)}); })
        .catch((r) => { resolve({err: r.message}); })
    });
  }

  _reloaddata() {
    return {
      name: this.obj.name,
      files: this.obj.files,
      path: this.obj.path,
      environments: this.obj.environments,
      targets: this.obj.targets
    };
  }
}

export = Workspace;
