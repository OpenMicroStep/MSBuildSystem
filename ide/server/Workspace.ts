/// <reference path="../../typings/tsd.d.ts" />
'use strict';

import path = require('path');
import BuildSystem = require('../../buildsystem/BuildSystem');
import WorkspaceFile = require('./WorkspaceFile');
import replication = require('./replication');
import fs = require('fs');

function taskInnerRUNCFGData(task: BuildSystem.Task) {
  return {
    id: task.id(),
    name: task.name,
    SHARED: task.getSharedData(),
    TMP: task.getTmpData(),
    CONFIGURE: task.getData(BuildSystem.Task.Action.CONFIGURE),
    RUN: task.getData(BuildSystem.Task.Action.RUN)
  }
}

function taskSimplifiedData(data) {
  return data ? {
    lastRunStartTime: data.lastRunStartTime,
    lastRunEndTime: data.lastRunEndTime,
    lastRunSucessTime: data.lastRunSucessTime,
    errors: data.errors,
  } : null;
}

function taskInnerData(task: BuildSystem.Task) {
  var cfg = task.getData(BuildSystem.Task.Action.CONFIGURE);
  var run = task.getData(BuildSystem.Task.Action.RUN);
  return {
    id: task.id(),
    name: task.name,
    CONFIGURE: taskSimplifiedData(cfg),
    RUN: taskSimplifiedData(run),
    tasks: []
  }
}

function taskData(task: BuildSystem.Task) : any {
  if (!task) return null;
  var r = taskInnerData(task);
  if (task instanceof BuildSystem.Graph) {
    task.allTasks().forEach((t) => {
      r.tasks.push(taskData(t));
    });
  }
  return r;
}

class Workspace extends replication.ServedObject<BuildSystem.Workspace> {
  buildGraph: BuildSystem.core.Flux;
  isrunning: boolean;

  constructor(directory: string) {
    super(new BuildSystem.Workspace(directory));
    this.isrunning = false;
    this._reload();
  }

  userData(pool) {
    fs.readFile(path.join(this.obj.directory, ".userdata"), 'utf8', (err, data) => {
      pool.context.response = (data && JSON.parse(data)) || {};
      pool.continue();
    });
  }
  setUserData(pool, data: any) {
    this.broadcast("userdata", data);
    fs.writeFile(path.join(this.obj.directory, ".userdata"), JSON.stringify(data, null, 2), 'utf8', (err) => {
      if (!err) pool.context.response = true;
      else pool.context.error = err;
      pool.continue();
    });
  }

  _reload() {
    var t0 = BuildSystem.util.timeElapsed("Graph created");
    this.buildGraph = this.obj.buildGraph({ variant: ['release', 'debug'] });
    this.buildGraph.setEndCallbacks((p) => {
      var g = p.context.root;
      if (!g) return;
      t0();
      g.on("childtaskend", (task) => {
        this.broadcast("taskend", {
          id: task.id(),
          name: task.name,
          action: BuildSystem.Task.Action[task.action],
          data: task.data
        });
      });
    });
  }

  reload(pool) {
    this.obj.reload();
    this.broadcast("reload", this.data());
    this._reload();
    pool.continue();
  }

  graph(pool) {
    return this.buildGraph.setEndCallbacks((p) => {
      var g = p.context.root;
      if (g) BuildSystem.util.timeElapsed("graph export", () => { pool.context.response = taskData(g); });
      pool.continue();
    });
  }

  taskInfos(pool) {
    return this.buildGraph.setEndCallbacks((p) => {
      var g = p.context.root;
      if (g) {
        BuildSystem.util.timeElapsed("logs export", () => {
          g.allTasks(true).forEach((t) => {
            this.emit(pool.context.socket, "taskinfo", taskInnerRUNCFGData(t));
          });
        });
        pool.context.response = true;
      }
      pool.continue();
    });
  }

  taskInfo(pool, taskId) {
    return this.buildGraph.setEndCallbacks((p) => {
      var g = p.context.root;
      if (g) {
        var task = g.findTask(true, (t) => { return t.id() === taskId });
        if (!task)
          pool.context.error = "unable to find task";
        else
          pool.context.response = taskInnerRUNCFGData(task);
      }
      pool.continue();
    });
  }

  openFile(pool, filepath: string) {
    WorkspaceFile.getShared(pool, path.isAbsolute(filepath) ? filepath : path.join(this.obj.directory, filepath));
  }

  start(pool, taskIds: string[]) {
    if (this.isrunning) { pool.context.error = "another task is already running"; pool.continue(); return ;}

    this.buildGraph.setEndCallbacks((p) => {
      var g = p.context.root;
      if (g) {
        if (g.state === BuildSystem.Task.State.RUNNING) { pool.context.error = "task is already running"; pool.continue(); return; }
        var missing = false;
        var tasks = taskIds.map((id) => {
          var ret = g.findTask(true, (t) => { return t.id() === id });
          if (!ret) missing= true;
          return ret;
        });
        if (missing) { pool.context.error = "unable to find all tasks"; pool.continue(); return; }
        var t0 = BuildSystem.util.timeElapsed("Build");
        g.reset();
        this.isrunning = true;
        tasks.forEach((t) => { t.enable(); });
        g.start(BuildSystem.Task.Action.RUN, () => {
          this.isrunning = false;
          t0();
          pool.context.response = true;
          pool.continue();
        });
      }
      pool.continue();
    });
  }

  data() {
    var env = [];
    for (var k in this.obj.environments) {
      var e = this.obj.environments[k];
      if (!_.isArray(e))
        env.push({ name: k });
      else
        console.log("no environment name", e);
    }
    return {
      name: this.obj.name,
      files: this.obj.files,
      path: this.obj.path,
      environments: env,
      targets: this.obj.targets
    };
  }
}

export = Workspace;
