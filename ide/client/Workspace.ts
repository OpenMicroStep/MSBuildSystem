import {replication, events, async, util, globals} from '../core';
import WorkspaceFile = require('./WorkspaceFile');
import Terminal = require('./Terminal');
import * as diagnostics from './diagnostics';
import Async = async.Async;
var forceLoadWorkspaceFile = WorkspaceFile;
var forceLoadTerminal = Terminal;

function isEnabled(list: string[], g: Workspace.Graph) {
  return !list || list.indexOf(g.name.name) !== -1;
}

class Workspace extends replication.DistantObject {
  path: string;
  directory: string;
  name: string;
  files: diagnostics.FileInfo[];
  targets: any[];
  environments: any[];
  dependencies: any[];
  runs: any[];
  variants: string[];
  _tasks: Map<string, Workspace.Graph>;
  _graph: (p: Async) => void;
  _build: { pendings: (()=> void)[], progress: number, nb: number, warnings: number, errors: number, type: string };

  static diagnostics: diagnostics.DiagnosticsByPath = new diagnostics.DiagnosticsByPath();
  static workspaces = new Set<Workspace>();
  constructor() {
    super();
    (<any>window)._workspace = this;
    this._tasks = new Map<any, any>();
    this._graph = null;
    this._build = null;
    this.on('reload', this.initWithData.bind(this));
    this.on("taskend", this.ontaskend.bind(this));
    Workspace.workspaces.add(this);
  }

  destroy() {
    Workspace.workspaces.delete(this);
    super.destroy();
  }

  initWithData(e, canSkipGraph?) {
    this._graph = null;
    this.name = e.name;
    this.path = e.path;
    this.directory = e.directory;
    Workspace.diagnostics.setFiles(this, e.files, this.files);
    this.files = e.files;
    this.environments = e.environments;
    this.targets = e.targets;
    this.dependencies = e.dependencies;
    this.runs = e.runs;
    this.variants = e.variants;
  }

  outofsync(p: Async) {
    replication.socket.emit('workspace', this.directory, (workspace: replication.DistantObjectProtocol) => {
      this.changeId(workspace.id);
      p.continue();
    });
  }

  loadDependencies(p: Async) {
    p.setFirstElements([
      this.dependencies.map((w) => { return (p) => {
        if (w.workspace) { p.continue(); return; }
        p.setFirstElements((p) => {
          w.workspace = p.context.result;
          w.workspace.loadDependencies(p);
        });
        this.openDependency(p, w.name);
      };})
    ]);
    p.continue();
  }

  reload(p: Async) {
    this.remoteCall(p, "reload");
  }

  buildGraph(p: Async, options) {
    var a = new Async(null, Async.once([
      (p) => {
        this._signal("build", { progress: 0.0, warnings: 0, errors: 0, state: "graph", working: true });
        this.remoteCall(p, "buildGraph", options);
      },
      (p) => {
        if (p.context.result)
          p.context.result = this._loadGraph(p.context.result);
        else
          this._graph = null;
        this._signal("build", { progress: 1.0, warnings: 0, errors: p.context.result ? 0 : 1, state: "graph", working: false });
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
        this.userData.bind(this),
        (p) => {
          var d = p.context.result || {};
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

  taskInfo(p: Async, taskId: string) {
    this.remoteCall(p, "taskInfo", taskId);
  }

  taskInfos(p: Async) {
    this.remoteCall(p, "taskInfos");
  }

  userData(p: Async) {
    p.setFirstElements((p) => {
      p.context.result = p.context.result || {};
      p.continue();
    });
    this.remoteCall(p, "userData");
  }

  setUserData(p: Async, data: any) {
    this.remoteCall(p, "setUserData", data);
  }

  build(p: Async) {
    p.setFirstElements([
      this.graph.bind(this),
      (p) => {
        var g = p.context.result;
        if (g)
          this._start(p, [g.id], "build");
        else
          p.continue();
      }
    ]);
    p.continue();
  }

  run(p: Async, run, env, variant) {
    var runner = this.runs.find((r) => { return r.name == run; });
    if (!runner || !env) {
      p.context.error = "Unable to find runner";
      p.continue();
      return;
    }
    this.remoteCall(p, "run", run, env, variant);
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
            this._graph = null;
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
          this._signal("build", e);
          pendings.forEach((fn) => { fn(); });
          p.continue();
        });
        this._signal("build", { progress: 0.0, warnings: 0, errors: 0, state: type, working: true });
        this.remoteCall(p, "start", taskIds, type);
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
      this._signal("build", { progress: this._build.progress / this._build.nb, warnings: this._build.warnings, errors: this._build.errors, state: this._build.type, working: true });
    }
  }

  openDependency(pool, name: string) {
    this.remoteCall(pool, "openDependency", name);
  }

  openFile(p: Async, path) {
    globals.ide.openFile(p, this.directory + "/" + path);
  }
}
replication.registerClass("Workspace", Workspace);

module Workspace {
  export import Diagnostic = diagnostics.Diagnostic;
  export var parseLogs = parseLogs;

  export interface ActionInfo {
    logs?: string,
    errors: number,
    lastRunStartTime: number,
    lastRunEndTime: number,
    lastSuccessTime: number,
  }

  export interface TaskInfo {
    id: string,
    name: { name: string, type: string },
    data: {
      SHARED: any,
      RUN: ActionInfo,
      CONFIGURE: ActionInfo
    }
  }

  export interface GraphInfo extends TaskInfo {
    id: string,
    name: { name: string, type: string },
    tasks: GraphInfo[];
  }

  export class Graph {
    id: string;
    name: { name: string, type: string, environment?: string, variant?: string };
    selfWarnings: number;
    selfErrors: number;
    deepWarnings: number;
    deepErrors: number;
    parent: Graph;
    diagnostics: diagnostics.Diagnostic[];
    tasks: Graph[];

    constructor(i: GraphInfo, parent: Graph) {
      this.id = i.id;
      this.name = i.name;
      this.parent = parent;
      this.tasks = [];
      this.diagnostics = [];
      this.selfWarnings = 0;
      this.selfErrors = 0;
      this.deepWarnings = 0;
      this.deepErrors = 0;
    }

    _setdiagnostics(source: () => diagnostics.Diagnostic[]) {
      this.diagnostics.forEach((d) => {
        Workspace.diagnostics.remove(d, this);
      });
      var diffWarnings = this.selfWarnings;
      var diffErrors = this.selfErrors;

      this.diagnostics = source();

      diffWarnings = this.selfWarnings - diffWarnings;
      diffErrors = this.selfErrors - diffErrors;
      var who: Graph = this;
      while (who) {
         who.deepWarnings += diffWarnings;
         who.deepErrors += diffErrors;
         who = who.parent;
      }
    }

    target() : Graph {
      var parent: Graph = this;
      while (parent && parent.name.type !== "target")
        parent = parent.parent;
      return parent;
    }

    fromold(old: Graph) {
      if (!old) return;
      this._setdiagnostics(() => {
        this.selfWarnings = old.selfWarnings;
        this.selfErrors = old.selfErrors;
        return old.diagnostics;
      });
    }

    ontaskend(e) {
      var diags = (e.data && e.data.diagnostics) || [];
      this._setdiagnostics(() => {
        this.selfWarnings = 0;
        this.selfErrors = 0;
        var diagsAfterMerge = [];
        var diagnostics = Workspace.diagnostics;
        for (var i=0,len= diags.length; i < len; ++i) {
          var diag = diags[i];
          if (diag.type === "warning")
            this.selfWarnings++;
          else if (diag.type === "error")
            this.selfErrors++;
          diagsAfterMerge.push(diagnostics.add(diag, this));
        }
        if (this.selfErrors === 0 && e.data.errors > 0)
          this.selfErrors += e.data.errors;
        return diagsAfterMerge;
      });
    }
  }

  export class LocalGraph {

  }
}

export = Workspace;

