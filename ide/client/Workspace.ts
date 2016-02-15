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
  error: string;

  static workspaces = new Set<Workspace>();
  constructor() {
    super();
    (<any>window)._workspace = this;
    this.on('reload', this.initWithData.bind(this));
    Workspace.workspaces.add(this);
  }

  destroy() {
    Workspace.workspaces.delete(this);
    super.destroy();
  }

  initWithData(e, canSkipGraph?) {
    this.name = e.name;
    this.path = e.path;
    this.directory = e.directory;
    this.files = e.files;
    this.environments = e.environments;
    this.targets = e.targets;
    this.dependencies = e.dependencies;
    this.runs = e.runs;
    this.variants = e.variants;
    this.error = e.error;
  }

  filePath(path) {
    return this.directory + "/" + path;
  }

  outofsync(p: Async) {
    p.setFirstElements((p) => {
      this.changeId(p.context.result.id);
      p.context.result.destroy();

      p.continue();
    });
    globals.ide.session.openWorkspace(p, this.directory);
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

  openDependency(pool, name: string) {
    this.remoteCall(pool, "openDependency", name);
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
      var manager = globals.ide.session.diagnostics;
      this.diagnostics.forEach((d) => {
        manager.remove(d, this);
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
      var manager = globals.ide.session.diagnostics;
      this._setdiagnostics(() => {
        this.selfWarnings = old.selfWarnings;
        this.selfErrors = old.selfErrors;
        return old.diagnostics.map((diag) => {
          return manager.add(diag, this);
        });
      });
    }

    ontaskend(e) {
      var diags = (e.data && e.data.diagnostics) || [];
      this._setdiagnostics(() => {
        this.selfWarnings = 0;
        this.selfErrors = 0;
        var diagsAfterMerge = [];
        var manager = globals.ide.session.diagnostics;
        for (var i=0,len= diags.length; i < len; ++i) {
          var diag = diags[i];
          if (diag.type === "warning")
            this.selfWarnings++;
          else if (diag.type === "error")
            this.selfErrors++;
          diagsAfterMerge.push(manager.add(diag, this));
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

