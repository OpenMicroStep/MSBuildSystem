/// <reference path="../../typings/browser.d.ts" />

import {replication, events, async} from '../core';
import WorkspaceFile = require('./WorkspaceFile');

//              1:path  2:row 3:col    4:ranges                      5:type                       6:msg     7:option     8:category
var rxdiag  = /^([^:]+):(\d+):(\d+):(?:((?:\{\d+:\d+-\d+:\d+\})+):)? (warning|error|note|remark): (.+?)(?:\[([^,\]]+)(?:,([^\]]+))?\])?$/;
//                     1:path       2-5:range                   6:replacement
var rxfixit = /^fix-it:"([^"]+)":\{(\d+):(\d+)-(\d+):(\d+)\}:"([^"]+)"$/;

function parseRanges(ranges: string) {
  if (!ranges) return [];
  return ranges.split('}{').map(function(range) {
    var m = range.match(/(\d+):(\d+)-(\d+):(\d+)/);
    return {srow:parseInt(m[1]), scol:parseInt(m[2]), erow:parseInt(m[3]), ecol:parseInt(m[4])};
  });
}

function isEnabled(list: string[], g: Workspace.Graph) {
  return !list || list.indexOf(g.name.name) !== -1;
}

class DiagnosticsByPath {
  map: Map<string, Set<Workspace.Diagnostic>>;
  constructor(public workspace: Workspace) {
    this.map = new Map<any, any>();
  }

  add(d: Workspace.Diagnostic) {
    var list = this.map.get(d.path);
    if (!list)
      this.map.set(d.path, list= new Set<any>());
    list.add(d);
    this.workspace._signal('diagnostic', { diag: d, action: 'add' });
  }

  get(p: string) {
    return this.map.get(p);
  }

  remove(d: Workspace.Diagnostic) {
    var dp = this.map.get(d.path);
    if (dp) {
      dp.delete(d);
      this.workspace._signal('diagnostic', { diag: d, action: 'del' });
    }
  }
}

class Workspace extends replication.DistantObject {
  path: string;
  name: string;
  files;
  targets;
  environments;
  _diagnostics: DiagnosticsByPath;
  _tasks: Map<string, Workspace.Graph>;
  _graph: async.Flux;
  _build: { pendings: (()=> void)[], progress: number, nb: number};
  _openFiles: Map<string, async.Flux>;

  constructor() {
    super();
    (<any>window)._workspace = this;
    this._openFiles = new Map<any, any>();
    this._diagnostics = new DiagnosticsByPath(this);
    this._tasks = new Map<any, any>();
    this._graph = null;
    this._build = null;
    this.on('reload', this.initWithData.bind(this));
    this.on("taskend", this.ontaskend.bind(this));
    this.on('taskinfo', this.ontaskinfo.bind(this));
  }

  initWithData(e) {
    this.name = e.name;
    this.path = e.path;
    this.files = e.files;
    this.environments = e.environments;
    this.targets = e.targets;
  }

  outofsync(f: async.Flux) {
    replication.socket.emit('rootWorkspace', (workspace: replication.DistantObjectProtocol) => {
      this.changeId(workspace.id);
      console.log(workspace.data);
      this.initWithData(workspace.data);
      if (!this._graph) {
        this._graph = (new async.Async(null, [
          (p) => { this.remoteCall(p, "graph"); },
          (p) => { p.context.graph = this._loadGraph(p.context.result); p.continue(); },
          (p) => { this.taskInfos(p); },
          (p) => { p.context.result = p.context.graph; p.continue(); },
        ])).continue();
      }
      this.graph(f);
    });
  }

  reload(p: async.Flux) {
    this.remoteCall(p, "reload");
  }

  graph(p: async.Flux) {
    this._graph.setEndCallbacks((f) => {
      p.context.result = f.context.result;
      p.continue();
    });
  }

  taskInfo(p: async.Flux, taskId: string) {
    p.setFirstElements((p) => {
      this.ontaskinfo(p.context.result);
      p.continue();
    });
    this.remoteCall(p, "taskInfo", taskId);
  }

  taskInfos(p: async.Flux) {
    this.remoteCall(p, "taskInfos");
  }

  userData(p: async.Flux) {
    p.setFirstElements((p) => {
      p.context.result = p.context.result || {};
      p.continue();
    });
    this.remoteCall(p, "userData");
  }

  setUserData(p: async.Flux, data: any) {
    this.remoteCall(p, "setUserData", data);
  }

  build(p: async.Flux) {
    p.setFirstElements([
      this.graph.bind(this),
      (p) => { p.context.graph = p.context.result; p.continue(); },
      this.userData.bind(this),
      (p) => {
        var g = p.context.graph;
        var d = p.context.result || {};
        var variants: string[] = Array.isArray(d.variants) ? d.variants : null;
        var envs: string[] = Array.isArray(d.environments) ? d.environments : null;
        var targets: string[] = Array.isArray(d.targets) ? d.targets : null;
        var taskIds = [];
        if (!variants && !envs && !targets)
          taskIds.push(g.id);
        else {
          g.tasks.forEach((variant) => {
            variant.tasks.forEach((env) => {
              env.tasks.forEach((target) => {
                if (isEnabled(variants, variant) && isEnabled(envs, env) && isEnabled(targets, target))
                  taskIds.push(target.id);
              });
            })
          });
        }
        this._start(p, taskIds);
      }
    ]);
    p.continue();
  }

  start(p: async.Flux, taskIds: string[]) {
    p.setFirstElements([
      this.graph.bind(this),
      (p) => { this._start(p, taskIds); }
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

  _start(p: async.Flux, taskIds: string[]) {
    if (this._build) {
      this._build.pendings.push(() => { this._start(p, taskIds); });
    }
    else {
      var nb = this._counttasks(taskIds);
      this._build = { pendings: [], progress: 0, nb: nb};
      p.setFirstElements((p) => {
        var pendings = this._build.pendings;
        this._build = null;
        this._signal("build", { progress: 1, working: false });
        pendings.forEach((fn) => { fn(); });
      });
      this._signal("build", { progress: 0, working: true });
      this.remoteCall(p, "start", taskIds);
    }
  }

  _loadGraph(graph: Workspace.GraphInfo) : Workspace.Graph {
    var tasks = new Map<string, Workspace.Graph>();
    var iterate = (g: Workspace.GraphInfo, p:Workspace.Graph) : Workspace.Graph => {
      var out = new Workspace.Graph(g, p);
      out.fromold(this._tasks.get(g.id), this._diagnostics);
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

  ontaskinfo(e) {
    var task = this._tasks.get(e.id);
    if (task)
      task.oninfo(e, this._diagnostics);
  }

  ontaskend(e) {
    var time = 0;
    var task = this._tasks.get(e.id);
    if (this._build) {
      this._build.progress++;
      this._signal("build", { progress: this._build.progress / this._build.nb, working: true });
    }
    if (task) {
      task.ontaskend(e, this._diagnostics);
    }
    else console.error("Task with not found", e);
  }

  diagnosticsAtPath(path: string) : Set<Workspace.Diagnostic> {
    return this._diagnostics.get(path);
  }

  openFile(p: async.Flux, path) {
    var ret = this._openFiles.get(path);
    if (!ret) {
      ret = (new async.Async(null, [
        (p) => { this.remoteCall(p, "openFile", path); },
        (p) => {
          var file: WorkspaceFile = p.context.result;
          file.workspace = this;
          file.on('destroy', () => {
            this._openFiles.delete(path);
          });
          p.continue();
          setTimeout(() => { file.unref(); }, 0);
        }
      ])).continue();
      this._openFiles.set(path, ret);
    }
    ret.setEndCallbacks((f) => {
      p.context.result = f.context.result;
      p.continue();
    });
  }
}
replication.registerClass("Workspace", WorkspaceFile);

module Workspace {
  export var parseLogs = parseLogs;

  export type Range = {srow:number, scol:number, erow:number, ecol:number};
  export interface Diagnostic {
    type: string,
    path: string,
    row: number,
    col: number,
    msg: string,
    option?: string,
    category?: string,
    ranges: Range[],
    notes: Diagnostic[],
    fixits?: { range: Range, path: string, replacement: string}[],
  }


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
    SHARED: any,
    TMP: any,
    RUN: ActionInfo,
    CONFIGURE: ActionInfo
  }

  export interface GraphInfo extends TaskInfo {
    id: string,
    name: { name: string, type: string },
    tasks: GraphInfo[];
  }

  export class Graph extends events.EventEmitter {
    id: string;
    name: { name: string, type: string };
    selfWarnings: number;
    selfErrors: number;
    deepWarnings: number;
    deepErrors: number;
    parent: Graph;
    diagnostics: Diagnostic[];
    tasks: Graph[];

    constructor(i: GraphInfo, parent: Graph) {
      super();
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

    _setdiagnostics(source: () => Diagnostic[], diagnostics: DiagnosticsByPath) {
      this.diagnostics.forEach((d) => {
        diagnostics.remove(d);
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
         if (diffWarnings !== 0 || diffErrors !== 0)
           who._signal("deepcountchange", this);
         who = who.parent;
      }
    }

    fromold(old: Graph, diagnostics: DiagnosticsByPath) {
      if (!old) return;
      this._setdiagnostics(() => {
        this.selfWarnings = old.selfWarnings;
        this.selfErrors = old.selfErrors;
        return old.diagnostics;
      }, diagnostics);
    }

    oninfo(info: TaskInfo, diagnostics: DiagnosticsByPath) {
      if (info.RUN) {
        this._setdiagnostics(() => {
          return this.parseLogs(info.RUN, diagnostics);
        }, diagnostics);
      }
    }

    ontaskend(e, diagnostics: DiagnosticsByPath) {
      this._setdiagnostics(() => {
        return this.parseLogs(e.data, diagnostics);
      }, diagnostics);
    }

    parseLogs(data: Workspace.ActionInfo, diagnostics: DiagnosticsByPath) {
      var diags = [];
      var logs = data.logs;
      var d, diag:Workspace.Diagnostic = null;
      this.selfWarnings = 0;
      this.selfErrors = 0;
      logs.split("\n").forEach((line) => {
        var matches = line.match(rxdiag);
        if (matches) {
          d = {
            type: matches[5],
            path: matches[1],
            row: parseInt(matches[2]),
            col: parseInt(matches[3]),
            ranges: parseRanges(matches[4]),
            msg: matches[6].trim(),
            option: matches[7],
            category: matches[8],
            notes: [],
            fixits: [],
            task: this
          }
          if (d.type === "note" && diag)
            diag.notes.push(d);
          else {
            diagnostics.add(d);
            diags.push(d);
            diag = d;
            if (d.type === "warning")
              this.selfWarnings++;
            else if (d.type === "error")
              this.selfErrors++;
          }
        }
        else if (diag && (matches = line.match(rxfixit))) {
          var fixit = {
            path: matches[1],
            replacement: matches[6],
            range: {srow:parseInt(matches[2]), scol:parseInt(matches[3]), erow:parseInt(matches[4]), ecol:parseInt(matches[5])}
          };
          diag.fixits.push(fixit);
        }
      });
      if (this.selfErrors === 0 && data.errors > 0)
        this.selfErrors = data.errors;
      return diags;
    }
  }

  export class LocalGraph {

  }
}

export = Workspace;

