/// <reference path="../../typings/tsd.d.ts" />
'use strict';

import path = require('path');
import BuildSystem = require('../../buildsystem/BuildSystem');
import WorkspaceFile = require('./WorkspaceFile');
import replication = require('./replication');
import fs = require('fs');

function taskInnerRUNCFGData(task: BuildSystem.Task, cb: (data) => void) {
  var s = task.getStorage();
  s.load(function() {
    cb({
      id: task.id(),
      name: task.name,
      data: s.all()
    });
  });
  var data = {
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
  return {
    id: task.id(),
    name: task.name,
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
  isrunning: boolean;
  graph: BuildSystem.core.Flux;
  $childtaskend;

  private static workspaces = {};

  /**
   * Get a shared across the whole process file.
   */
  static getShared(workspacePath:string):Workspace {
    workspacePath = path.normalize(workspacePath);
    if (!path.isAbsolute(workspacePath))
      throw "'workspacePath' must be absolute (workspacePath=" + workspacePath + ")";

    var workspace = Workspace.workspaces[workspacePath];
    if (!workspace)
      workspace = Workspace.workspaces[workspacePath] = new Workspace(workspacePath);
    return workspace;
  }

  constructor(directory: string) {
    super(new BuildSystem.Workspace(directory));
    this.isrunning = false;
    this.$childtaskend = (task) => {
      this.broadcast("taskend", {
        id: task.id(),
        name: task.name,
        action: BuildSystem.Task.Action[task.action],
        data: task.data
      });
    };
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

  reload(pool) {
    this.obj.reload();
    this.broadcast("reload", this.data());
    pool.continue();
  }

  buildGraph(p, options: BuildSystem.Workspace.BuildGraphOptions) {
    if (this.graph) {
      this.graph.setEndCallbacks((f) => {
        var g = f.context.root;
        if (g) g.removeListener("childtaskend", this.$childtaskend);
      });
    }
    var t0 = BuildSystem.util.timeElapsed("Build graph");
    this.graph = (new BuildSystem.core.Async(null, (p) => { this.obj.buildGraph(p, options); })).continue();
    this.graph.setEndCallbacks((f) => {
      var g = f.context.root;
      if (g) {
        t0();
        g.on("childtaskend", this.$childtaskend);
        BuildSystem.util.timeElapsed("graph export", () => { p.context.response = taskData(g); });
      }
      else {
        console.warn("Unable to build graph", f.context.error, (f.context.error || {}).stack);
      }
      p.continue();
    });
  }

  taskInfos(pool) {
    if (!this.graph) { pool.context.error = "buildGraph wasn't called before taskInfo"; pool.continue(); return; }

    return this.graph.setEndCallbacks((p) => {
      var g = p.context.root;
      if (g) {
        var t0 = BuildSystem.util.timeElapsed("logs export");
        var tasks: BuildSystem.Task[] = <any>Array.from(g.allTasks(true));
        var i = 0, len = tasks.length;
        var next = () => {
          if (i < len) {
            taskInnerRUNCFGData(tasks[i], (d) => {
              this.emit(pool.context.socket, "taskinfo", d);
              setTimeout(next, 1);
            });
            ++i;
          }
          else {
            t0();
            pool.context.response = true;
            pool.continue();
          }
        };
        next();
      }
    });
  }

  taskInfo(pool, taskId) {
    if (!this.graph) { pool.context.error = "buildGraph wasn't called before taskInfo"; pool.continue(); return; }
    return this.graph.setEndCallbacks((p) => {
      var g = p.context.root;
      if (g) {
        var task = g.findTask(true, (t) => { return t.id() === taskId });
        if (!task) {
          pool.context.error = "unable to find task";
          pool.continue();
        }
        else {
          taskInnerRUNCFGData(task, (d) => {
            pool.context.response = d;
            pool.continue();
          })
        }
      }
    });
  }

  openFile(pool, filepath: string) {
    WorkspaceFile.getShared(pool, path.isAbsolute(filepath) ? filepath : path.join(this.obj.directory, filepath));
  }

  start(pool, taskIds: string[]) {
    if (this.isrunning) { pool.context.error = "another task is already running"; pool.continue(); return ;}
    if (!this.graph) { pool.context.error = "buildGraph wasn't called before taskInfo"; pool.continue(); return; }

    this.graph.setEndCallbacks((p) => {
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
        BuildSystem.core.File.clearStats();
        this.isrunning = true;
        tasks.forEach((t) => { t.enable(); });
        g.start(BuildSystem.Task.Action.RUN, () => {
          this.isrunning = false;
          t0();
          pool.context.response = true;
          pool.continue();
        });
      }
      else { pool.continue(); }
    });
  }

  openDependency(pool, name: string) {
    var d = this.obj.dependencies.find((d) => { return d.name === name; });
    if (d) {
      var depPath = d.path;
        if (path.isAbsolute(depPath))
          pool.context.response = Workspace.getShared(depPath);
        else
          pool.context.response = Workspace.getShared(path.join(this.obj.directory, depPath));
    }
    pool.continue();
  }

  data() {
    return {
      name: this.obj.name,
      files: this.obj.files,
      path: this.obj.path,
      environments: this.obj.environments,
      targets: this.obj.targets,
      dependencies: this.obj.dependencies
    };
  }
}

export = Workspace;
