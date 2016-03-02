import { async, replication, util } from '../core';
import SearchInFiles = require('../views/SearchInFiles');
import WorkspaceFile = require('./WorkspaceFile');
import diagnostics = require('./diagnostics');
import Workspace = require('./Workspace');
import Async = async.Async;

function inpath(ep, pp) {
  var pl = pp.length;
  var el = ep.length;
  if (pl > el) return false;
  for (var i = 0; i < pl && pp[i] === ep[i]; ++i);
  return (i === pl);
}

function samepath(pp, ep) {
  var pl = pp.length;
  var el = ep.length;
  if (pl !== el) return false;
  for (var i = 0; i < pl && pp[i] === ep[i]; ++i);
  return (i === pl);
}

class Session extends replication.DistantObject {
  sessionid: string;
  path: string;
  userdata: any;
  userdataschedule: any;
  _openFiles: Map<string, Async>;
  workspace: Workspace;
  _tasks: Map<string, Workspace.Graph>;
  _graph: (p: Async) => void;
  _build: { pendings: (()=> void)[], progress: number, nb: number, warnings: number, errors: number, type: string };
  _onsets: { path: string[], cb: (value: any) => void, defaultValue:any }[];
  diagnostics: diagnostics.DiagnosticsManager;

  constructor() {
    super();
    this._openFiles = new Map<any, any>();
    this._tasks = new Map<any, any>();
    this.diagnostics = new diagnostics.DiagnosticsManager();
    this._graph = null;
    this._build = null;
    this._onsets = [];
    this.path = location.hash.substring(1);
    this.sessionid = this.path;
    this.userdata = null;
    this.userdataschedule = util.schedule(this._setuserdata.bind(this));
    this.onSet(['buildgraph'], this.clearGraph.bind(this));
    var m = this.sessionid.match(/^session:(\w+)=(.+)$/);
    if (m) {
      this.path = m[2];
      this.sessionid = m[1];
    }
    Async.run(null, [
      (p) => { this.remoteCall(p, "userData"); },
      (p) => { this.userdata = p.context.result || {}; p.continue(); },
      (p) => { this.openWorkspace(p, this.path); },
      (p) => {
        this.workspace = p.context.result;
        this.workspace.on("taskend", this.ontaskend.bind(this));
        if (this.workspace && !this.workspace.error) {
          document.title = this.workspace.name;
          p.setFirstElements([
            this.workspace.loadDependencies.bind(this.workspace),
            this.workspaceReady.bind(this),
            (p) => { this._signal("ready"); p.continue();}
          ]);
        }
        else {
          this._signal("error", { error: p.context.error || (this.workspace && this.workspace.error) });
        }
        p.continue();
      },
      /*(p) => {
        this._onsets.forEach((p) => {
          p.cb(this.get(p.path, p.defaultValue));
        });
      }*/
    ]);
  }

  initWithData(data) {}

  outofsync(p: async.Async) {
    replication.socket.emit('getsession', this.sessionid, (session) => {
      this.changeId(session.id);
      this.initWithData(session.data);
      p.continue();
    });
  }

  reconnect(data) {
    this.initWithData(data);
  }
  openWorkspace(p, path) {
    this.remoteCall(p, "openWorkspace", path);
  }

  workspaceReady(p) {
    this.diagnostics.setWorkspace(this.workspace);
    this.clearGraph();
    p.continue();
  }

  openFile(p: Async, path, nocache?) {
    var once = !nocache ? this._openFiles.get(path) : null;
    if (!once) {
      once = new Async(null, Async.once([
        (p) => { this.remoteCall(p, "openFile", path); },
        (p) => {
          var file: WorkspaceFile = p.context.result;
          var workspace = null;
          Workspace.workspaces.forEach((w) => { if (w.path === file.path) workspace = w; });
          if (workspace) {
            file.on('saved', () => { async.run(null, [
              workspace.reload.bind(workspace),
              workspace.loadDependencies.bind(workspace),
              this.workspaceReady.bind(this),
              (p) => { this._signal('reload-workspace'); p.continue(); }
            ]); });
          }
          file.on('destroy', () => {
            this._openFiles.delete(path);
          });
          p.continue();
          setTimeout(() => { file.unref(); }, 0);
        }
      ]));
      if (!nocache)
        this._openFiles.set(path, once);
    }
    p.setFirstElements([
      once,
      (p) => {
        p.context.file = once.context.result;
        p.continue();
      }
    ]);
    p.continue();
  }

  saveFiles(p: Async) {
    var s = [];
    this._openFiles.forEach((once) => {
      s.push(new Async(null, [
        once,
        (p) => {
          var file = once.context.result;
          if (file && file.hasUnsavedChanges())
            file.save(p, file);
          else
            p.continue();
        }
      ]));
    });
    p.setFirstElements([s]);
    p.continue();
  }

  find(p: Async, options: SearchInFiles.FindOptions) {
    this.remoteCall(p, "find", options);
  }

  replace(p: Async, options: SearchInFiles.ReplaceOptions) {
    this.remoteCall(p, "replace", options);
  }

  buildGraph(p: Async, options) {
    var a = new Async(null, Async.once([
      (p) => {
        this._signal("status", { progress: 0.0, warnings: 0, errors: 0, state: "graph", working: true });
        this.workspace.remoteCall(p, "buildGraph", options);
      },
      (p) => {
        if (p.context.result)
          p.context.result = this._loadGraph(p.context.result);
        else
          this._graph = null;
        this._signal("status", { progress: 1.0, warnings: 0, errors: p.context.result ? 0 : 1, state: "graph", working: false });
        //async.run(null, [this.taskInfos.bind(this)]);
        p.continue();
      }
    ]));
    this._graph = (p) => {
      p.setFirstElements([a, (p) => { p.context.result = a.context.result; p.continue(); }]);
      p.continue();
    };
    p.setFirstElements(this._graph);
    p.continue();
  }

  graph(p: Async) {
    if (!this._graph) {
      p.setFirstElements([
        (p) => {
          var d = this.get(['buildgraph'], {});
          var variants: string[] = Array.isArray(d.variants) ? d.variants : null;
          var envs: string[] = Array.isArray(d.environments) ? d.environments : null;
          var targets: string[] = Array.isArray(d.targets) ? d.targets : null;
          var options = { variants: variants, environments: envs, targets: targets };
          this.buildGraph(p, options);
        }
      ]);
    }
    else {
      p.setFirstElements(this._graph);
    }
    p.continue();
  }

  clearGraph() {
    this._graph = null;
  }

  build(p: Async) {
    p.setFirstElements([
      this.saveFiles.bind(this),
      this.graph.bind(this),
      (p) => {
        var g = p.context.result;
        if (g)
          this._start(p, [g.id], "build");
        else
          p.continue();
      },
      /*TODO(p) => {
        if (p.context.error)
          this._status.setStatus({ label: p.context.error, errors: 1 });
        p.continue();
      }*/
    ]);
    p.continue();
  }

  run(p: Async, run: string, env: string, variant: string) {
    p.setFirstElements([
      this.build.bind(this),
      (p) => {
        var runner = this.workspace.runs.find((r) => { return r.name == run; });
        if (!runner || !env) {
          p.context.error = "Unable to find runner";
          p.continue();
          return;
        }
        this.workspace.remoteCall(p, "run", run, env, variant);
      }
    ]);
    p.continue();
  }

  clean(p: Async) {
    p.setFirstElements([
      this.graph.bind(this),
      (p) => {
        var g = p.context.result;
        this._start(p, [g.id], "clean");
      }
    ]);
    p.continue();
  }

  start(p: Async, taskIds: string[], type = "build") {
    p.setFirstElements([
      this.graph.bind(this),
      (p) => { this._start(p, taskIds, type); }
    ]);
    p.continue();
  }

  _counttasks(taskIds: string[]) {
    function subs(task: Workspace.Graph) {
      nb++;
      if (task && task.tasks) {
        for(var i = 0, len = task.tasks.length; i < len; i++) {
          subs(task.tasks[i]);
        }
      }
    }
    var nb = 0;
    taskIds.forEach((tid) => {
      subs(this._tasks.get(tid));
    });
    return nb;
  }

  _start(p: Async, taskIds: string[], type) {
    if (this._build) {
      this._build.pendings.push(() => { this._start(p, taskIds, type); });
    }
    else {
      var start = (p: Async, taskIds, type) => {
        var nb = this._counttasks(taskIds);
        this._build = { pendings: [], progress: 0, nb: nb, warnings: 0, errors: 0, type: type };
        p.setFirstElements((p) => {
          if (p.context.error && p.context.error.code === "buildGraphMissing") {
            this.clearGraph();
            p.setFirstElements([
              this.graph.bind(this),
              (p) => { start(p, taskIds, type); }
            ]);
            p.continue();
            return;
          }
          var pendings = this._build.pendings;
          if (p.context.result !== 0 && this._build.errors == 0)
            this._build.errors += p.context.result;
          var e = { progress: 1.0, warnings: this._build.warnings, errors: this._build.errors, state: type, working: false };
          this._build = null;
          this._signal("status", e);
          pendings.forEach((fn) => { fn(); });
          p.continue();
        });
        this._signal("status", { progress: 0.0, warnings: 0, errors: 0, state: type, working: true });
        this.workspace.remoteCall(p, "start", taskIds, type);
      }
      start(p, taskIds, type);
    }
  }

  _loadGraph(graph: Workspace.GraphInfo) : Workspace.Graph {
    var tasks = new Map<string, Workspace.Graph>();
    var iterate = (g: Workspace.GraphInfo, p:Workspace.Graph) : Workspace.Graph => {
      var out = new Workspace.Graph(g, p);
      out.fromold(this._tasks.get(g.id));
      tasks.set(g.id, out);
      for(var t of g.tasks)
        out.tasks.push(iterate(t, out));
      return out;
    }
    var ret = iterate(graph, null);
    var set = function() { return [] };
    this._tasks.forEach((task) => { task._setdiagnostics(set); })
    this._tasks = tasks;
    this._signal('graph', ret);
    return ret;
  }

  ontaskend(e) {
    var time = 0;
    var task = this._tasks.get(e.id);
    if (task) {
      task.ontaskend(e);
    }
    else console.error("Task with not found", e);
    if (this._build) {
      this._build.progress++;
      this._build.warnings += task ? task.selfWarnings : 0;
      this._build.errors += task ? task.selfErrors : 0;
      this._signal("status", { progress: this._build.progress / this._build.nb, warnings: this._build.warnings, errors: this._build.errors, state: this._build.type, working: true });
    }
  }

  get(path: string[], defaultvalue?) {
    var d = this.userdata;
    for(var i = 0, len = path.length; d !== void 0 && i < len; ++i)
      d = d[path[i]];
    d = i == len ? d : undefined;
    if (d === void 0 && defaultvalue !== void 0) {
      this.set(path, defaultvalue);
      d = defaultvalue
    }
    return d;
  }

  set(path: string[], value) {
    var t, d = this.userdata;
    for(var i = 0, len = path.length - 1; i < len; ++i) {
      t = d[path[i]];
      if (t === void 0 || typeof t !== "object")
        d[path[i]] = t = {};
      d = t;
    }
    d[path[i]] = value;
    this.userdataschedule();
    this._onsets.forEach((p) => {
      if (inpath(path, p.path))
        p.cb(this.get(p.path));
    });
  }

  onSet(path: string[], cb: (value: any) => void, defaultValue?) {
    this._onsets.push({ path: path, cb: cb, defaultValue: defaultValue });
  }
  offSet(path: string[], cb) {
    var idx = this._onsets.findIndex((i) => { return i.cb === cb && samepath(i.path, path); });
    if (idx !== -1)
      this._onsets.splice(idx, 1);
  }

  _setuserdata() {
    //console.log("set user data", this.userdata);
    Async.run(null, (p) => { this.remoteCall(p, "setUserData", this.userdata); });
  }

  taskInfo(p: Async, taskId: string) {
    this.workspace.remoteCall(p, "taskInfo", taskId);
  }

  taskInfos(p: Async) {
    this.workspace.remoteCall(p, "taskInfos");
  }
}
replication.registerClass("Session", Session);

export = Session;