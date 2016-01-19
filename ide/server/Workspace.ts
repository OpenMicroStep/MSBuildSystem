import path = require('path');
import BuildSystem = require('../../buildsystem/BuildSystem');
import WorkspaceFile = require('./WorkspaceFile');
import replication = require('./replication');
import Terminal = require('./Terminal');
import fs = require('fs');
import Async = BuildSystem.core.Async;

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

function escapeRegExp(str) {
    return str.replace(/([.*+?^${}()|[\]\/\\])/g, '\\$1');
}

class Workspace extends replication.ServedObject<BuildSystem.Workspace> {
  isrunning: boolean;
  graph: (p: Async) => void;
  $childtaskend;

  static workspaces = {};

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

  _searchOrReplace(p, replace: boolean, options) {
    var set= new Set<string>();
    function iterate(files, directory) {
      for(var i = 0, len = files.length; i < len; ++i) {
        var file = files[i];
        if (file.file)
          set.add(path.join(directory, file.file));
        else if (file.files)
          iterate(file.files, directory);
      }
    }
    for (var w in Workspace.workspaces) {
      var workspace: Workspace = Workspace.workspaces[w];
      iterate(workspace.obj.files, workspace.obj.directory);
    }

    var opts = [];
    if (options.regexp) opts.push("regex");
    if (options.casesensitive) opts.push("case sensitive");
    if (options.wholeword) opts.push("whole word");
    if (options.showcontext) opts.push("context");
    var result = "Searching for " + options.searchtext + " inworkspaces files" + opts.join(', ') + "\n\n";
    var files = Array.from(set);
    var i = 0;
    var context = typeof options.showcontext === "number" ? options.showcontext : 0;
    var searchtext = options.regexp ? options.searchtext : escapeRegExp(options.searchtext);
    if (options.wholeword) searchtext = "\\b" + searchtext + "\\b";
    var rx = new RegExp(searchtext, options.casesensitive ? "g": "gi");
    var matches = 0;
    var matchFiles = 0;
    var printline = (pad: string, row: number, line: string, context: boolean) => {
      var r = (row + 1).toString();
      result += pad.substring(0, pad.length - r.length) + r;
      result += (context ? "  " : ": ") + line + "\n";
    }
    var parsecontent = (path: string, content: string) => {
      var m, first= true, pad, ctxline, ctxend, last = -1;
      var lines = content.split("\n");
      for (var i = 0, len = lines.length; i < len; ++i) {
        var line = lines[i];
        var found = false;
        while ((m = rx.exec(line)) !== null) {
          ++matches;
          if (first) {
            ++matchFiles;
            result += path + ":\n";
            pad = "         ".substring(0, Math.max(len.toString().length + 1, 6));
          }
          var start = m.index;
          var end = m.index + m[0].length;

          if (!found) {
            if (context > 0) {
              var ctxstart = Math.max(i - context, last + 1, 0);
              if (last !== -1 && last < ctxstart) {
                for (ctxline= last + 1, ctxend= Math.min(last + context + 1, lines.length, ctxstart); ctxline < ctxend; ++ctxline)
                  printline(pad, ctxline, lines[ctxline], true);
                if (ctxline + 1 === ctxstart)
                  printline(pad, ctxline, lines[ctxline], true);
                else if (ctxline < ctxstart) {
                  var dots = "..........".substring(0, ctxline.toString().length);
                  result += pad.substring(0, pad.length - dots.length) + dots + "\n";
                }
              }
              for (ctxline= ctxstart; ctxline < i; ++ctxline)
                printline(pad, ctxline, lines[ctxline], true);
            }
            printline(pad, i, line, false);
            last = i;
          }
          found = true;
          first = false;
        }
      }
      if (!first) {
        if (context > 0) {
          for (ctxline= last + 1, ctxend= Math.min(last + context + 1, lines.length); ctxline < ctxend; ++ctxline)
            printline(pad, ctxline, lines[ctxline], true);
        }
        result += "\n";
      }
      next();
    }
    var next = () => {
      if (i < files.length) {
        var file = files[i++];
        var wf = WorkspaceFile.files.get(file);
        if (wf) {
          parsecontent(file, wf.getLastVersion());
        }
        else {
          fs.readFile(file, 'utf8', (err, data) => {
            if (err) next();
            else parsecontent(file, data);
          })
        }
      }
      else {
        result += matches + " matches across " + matchFiles + " files";
        p.context.response = result;
        p.continue();
      }
    }
    next();
  }

  find(p, options) {
    this._searchOrReplace(p, false, options);
  }

  replace(p, options) {
    this._searchOrReplace(p, true, options);
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
      this.clearGraph();
      pool.continue();
    });
  }

  reload(pool) {
    this.obj.reload();
    this.broadcast("reload", this.data());
    pool.continue();
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
      p.setFirstElements([g, (p) => { p.context.root = g.context.root; p.continue(); }]);
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

  openFile(pool, filepath: string) {
    WorkspaceFile.getShared(pool, path.isAbsolute(filepath) ? filepath : path.join(this.obj.directory, filepath));
  }

  start(p: Async, taskIds: string[], type) {
    if (this.isrunning) {p.context.error = errors.buildRunning; p.continue(); return ;}
    if (!this.graph) { p.context.error = errors.buildGraphMissing; p.continue(); return; }

    p.setFirstElements([
      this.graph,
      (p) => {
        var g = p.context.root;
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
            p.context.response = true;
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

  terminal(p: Async) {
    p.context.response = new Terminal("bash", ["-l"]);
    p.continue();
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
      variants: ["debug", "release"]
    };
  }
}

export = Workspace;
