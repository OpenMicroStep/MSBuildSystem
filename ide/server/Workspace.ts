import path = require('path');
import BuildSystem = require('../../buildsystem/BuildSystem');
import WorkspaceFile = require('./WorkspaceFile');
import replication = require('./replication');
import fs = require('fs');
import Async = BuildSystem.core.Async;
import Terminal = require('./Terminal');

var errors = {
  buildGraphMissing: {
    code: "buildGraphMissing",
    msg: "buildGraph wasn't called before taskInfo"
  },
  buildRunning: {
    code: "buildRunning",
    msg: "another task is already running"
  },
  runnerMissing: {
    code: "runnerMissing",
    msg: "runner not found"
  }
}
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
  graph: (p: Async) => void;
  $childtaskend;

  static workspaces = {};

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

  reload(pool) {
    this.obj.reload();
    this.broadcast("reload", this.data());
    pool.continue();
  }

  openFile(pool, filepath: string) {
    WorkspaceFile.getShared(pool, path.isAbsolute(filepath) ? filepath : path.join(this.obj.directory, filepath));
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
      directory: this.obj.directory,
      files: this.obj.files,
      path: this.obj.path,
      environments: this.obj.environments,
      targets: this.obj.targets,
      dependencies: this.obj.dependencies,
      runs: this.obj.runs,
      variants: ["debug", "release"],
      error: this.obj.error
    };
  }

  clearGraph() {
    if (this.graph) {
      Async.run(null, [
        this.graph,
        (p) => {
          var g = p.context.root;
          if (g) g.removeListener("childtaskend", this.$childtaskend);
          p.continue();
        }
      ]);
      this.graph = null;
    }
  }

  buildGraph(p: Async, options: BuildSystem.Workspace.BuildGraphOptions) {
    var t0 = BuildSystem.util.timeElapsed("Build graph");
    var g = new Async(null, Async.once((p) => { this.obj.buildGraph(p, options); }));
    this.graph = (p) => {
      p.setFirstElements([g, (p) => {
        p.context.error = g.context.error;
        p.context.root = g.context.root;
        p.continue();
      }]);
      p.continue();
    };
    p.setFirstElements([
      this.graph,
      (p) => {
        var g = p.context.root;
        if (g) {
          t0();
          g.on("childtaskend", this.$childtaskend);
          BuildSystem.util.timeElapsed("graph export", () => { p.context.response = taskData(g); });
        }
        else {
          console.warn("Unable to build graph", p.context.error, (p.context.error || {}).stack);
        }
        p.continue();
      }
    ]);
    p.continue();
  }

  taskInfos(p: Async) {
    if (!this.graph) { p.context.error = errors.buildGraphMissing; p.continue(); return; }
    p.setFirstElements([
      this.graph,
      (p) => {
        var g = p.context.root;
        if (g) {
          var t0 = BuildSystem.util.timeElapsed("logs export");
          var tasks: BuildSystem.Task[] = <any>Array.from(g.allTasks(true));
          var i = 0, len = tasks.length;
          var next = () => {
            if (i < len) {
              taskInnerRUNCFGData(tasks[i], (d) => {
                this.emit(p.context.socket, "taskinfo", d);
                setTimeout(next, 1);
              });
              ++i;
            }
            else {
              t0();
              p.context.response = true;
              p.continue();
            }
          };
          next();
        }
      }
    ]);
    p.continue();
  }

  taskInfo(p: Async, taskId) {
    if (!this.graph) { p.context.error = errors.buildGraphMissing; p.continue(); return; }
    p.setFirstElements([
      this.graph,
      (p) => {
        var g = p.context.root;
        if (g) {
          var task = g.findTask(true, (t) => { return t.id() === taskId });
          if (!task) {
            p.context.error = "unable to find task";
            p.continue();
          }
          else {
            taskInnerRUNCFGData(task, (d) => {
              p.context.response = d;
              p.continue();
            })
          }
        }
      }
    ]);
    p.continue();
  }

  start(p: Async, taskIds: string[], type) {
    if (this.isrunning) {p.context.error = errors.buildRunning; p.continue(); return ;}
    if (!this.graph) { p.context.error = errors.buildGraphMissing; p.continue(); return; }

    p.setFirstElements([
      this.graph,
      (p) => {
        var g: BuildSystem.Graph = p.context.root;
        if (g) {
          if (g.state === BuildSystem.Task.State.RUNNING) { p.context.error = "task is already running"; p.continue(); return; }
          var missing = false;
          var tasks = taskIds.map((id) => {
            var ret = g.findTask(true, (t) => { return t.id() === id });
            if (!ret) missing= true;
            return ret;
          });
          if (missing) { p.context.error = "unable to find all tasks"; p.continue(); return; }
          var t0 = BuildSystem.util.timeElapsed("Build");
          g.reset();
          BuildSystem.core.File.clearStats();
          this.isrunning = true;
          tasks.forEach((t) => { t.enable(); });
          g.start(type === "clean" ? BuildSystem.Task.Action.CLEAN : BuildSystem.Task.Action.RUN, () => {
            this.isrunning = false;
            t0();
            p.context.response = g.errors;
            p.continue();
          });
        }
        else { p.continue(); }
      }
    ]);
    p.continue();
  }

  run(p: Async, run, env, variant) {
    if (!this.graph) { p.context.error = errors.buildGraphMissing; return p.continue(); }
    var runner = this.obj.runs.find((r) => { return r.name === run; });
    if (!runner) { p.context.error = errors.runnerMissing; return p.continue(); }
    console.info("will run", run, env, variant);
    p.setFirstElements([
      this.graph,
      (p) => {
        var g: BuildSystem.Graph = p.context.root;
        if (g) {
          var err = [];
          var expand = (what) => {
            if (typeof what === "string")
              return what;
            if (what.target) {
              var target: any = g.findTask(false, (t: any) => {
                return t.name.name === what.target
                    && t.name.environment === env
                    && t.name.variant === variant
              });
              if (target)
                return target.sysroot.linkFinalPath(target);
            }
            err.push(what);
          };
          var path = expand(runner.path);
          var args = runner.arguments ? runner.arguments.map(expand) : [];
          //args.unshift(path);
          console.info("run", path, args);
          if (err.length == 0)
            p.context.response = new Terminal(path, args);
          p.continue();
        }
        else { p.continue(); }
      }
    ]);
    p.continue();
  }

}

export = Workspace;
