import {replication, events, async, util} from '../core';
import Workspace = require('./Workspace');

export type Range = {srow:number, scol:number, erow:number, ecol:number};
export type Fixit = { range: Range, path: string, replacement: string };
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
  fixits?: Fixit[],
  tasks?: Set<Workspace.Graph>,
}
export type FileInfo = {
  file?: string,
  group?: string,
  files?: FileInfo[],
};

export type FileTree = {
  warnings: number,
  errors: number,
  infos: any,
  parents: FileTree[],
  childs: FileTree[],
};

export class DiagnosticsManager extends events.EventEmitter {
  byPath: Map<string, Diagnostic[]>;
  byType: Map<string, Diagnostic[]>;
  byTreeLeaf: Map<string, FileTree[]>;
  tree: FileTree;

  constructor() {
    super();
    this.byPath = new Map<any, any>();
    this.byType = new Map<any, any>();
    this.byTreeLeaf = new Map<any, any>();
    this.tree = null;
  }

  setWorkspace(workspace: Workspace) {
    this.byTreeLeaf = new Map<any, any>();
    var workspaces = new Map<any, any>();
    this.tree = this._buildTree(workspace, workspaces, null);
    console.log(this.tree);
    this.byPath.forEach((diags) => {
      diags.forEach((d) => {
        this._applyToTree(d, +1);
      });
    });
  }

  _buildTree(workspace, workspaces, parent) {
    var root = workspaces.get(workspace);
    if (root) {
      if (parent)
        root.parents.push(parent);
    }
    else {
      root= { warnings: 0,errors: 0, parents: [], infos: workspace, childs: [] };
      workspaces.set(workspace, root);
      if (parent)
        root.parents.push(parent);
      if (workspace.dependencies.length) {
        var deps = { warnings: 0,errors: 0, parents: [root], infos: "dependencies", childs: [] }
        root.childs.push(deps);
        workspace.dependencies.forEach((w) => {
          deps.childs.push(this._buildTree(w.workspace, workspaces, deps));
        });
      }
      this._buildFileTree(workspace, workspace.files, root);
    }
    return root;
  }

  _buildFileTree(workspace, files, parent) {
    files.forEach((f) => {
      var node = { warnings: 0,errors: 0, parents: [parent], childs: [], infos: f };
      parent.childs.push(node);
      if (f.file) {
        var path = workspace.directory + "/" + f.file;
        var nodes = this.byTreeLeaf.get(path);
        if (!nodes)
          this.byTreeLeaf.set(path, nodes= [node]);
        else
          nodes.push(node);
      }
      else if (f.files) {
        this._buildFileTree(workspace, f.files, node);
      }
    });
  }

  _applyToTree(d: Diagnostic, delta) {
    var nodes = this.byTreeLeaf.get(d.path);
    var w = d.type === "warning" ? delta : 0;
    var e = d.type === "error" ? delta : 0;
    function apply(leaf) {
      leaf.warnings += w;
      leaf.errors += e;
      leaf.parents.forEach(apply);
    }
    if (nodes)
      nodes.forEach(apply);
  }

  _add(d: Diagnostic) {
    this._applyToTree(d, +1);
    this._signal('diagnostic', { diag: d, action: 'add' });
  }

  _del(d: Diagnostic) {
    this._applyToTree(d, -1);
    this._signal('diagnostic', { diag: d, action: 'del' });
  }

  add(d: Diagnostic, task: Workspace.Graph) : Diagnostic {
    var diagnostics = this.byPath.get(d.path);
    var merged = false;
    if (!diagnostics) {
      this.byPath.set(d.path, [d]);
      d.tasks = new Set<any>();
    }
    else {
      diagnostics.forEach((diag) => {
        if (merged) return;
        if (diag.row === d.row && diag.col === d.col && diag.msg === d.msg) {
          diag.tasks.add(task);
          merged = true;
          d = diag;
        }
      });
      if (!merged) {
        diagnostics.push(d);
        d.tasks = new Set<any>();
      }
    }
    if (!merged) {
      d.tasks.add(task);
      this._add(d);
    }
    return d;
  }

  remove(d: Diagnostic, task: Workspace.Graph) {
    d.tasks.delete(task);
    if (d.tasks.size === 0) {
      var diagnostics = this.byPath.get(d.path);
      var idx = diagnostics.indexOf(d);
      diagnostics.splice(idx, 1);
      if (diagnostics.length === 0) {
        this.byPath.delete(d.path);
        this._del(d);
      }
    }
  }
}
