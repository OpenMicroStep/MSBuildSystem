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
  diagnostics?: { set: Set<Diagnostic>, warnings: number, errors: number, parent: FileInfo }
};
export class DiagnosticsByPath extends events.EventEmitter {
  files: Map<string, FileInfo>;

  constructor() {
    super();
    this.files = new Map<any, any>();
  }

  setFiles(workspace: Workspace, news: FileInfo[], olds: FileInfo[]) {
    var directory = workspace.directory + '/';
    if (olds) {
      var rem = (files: FileInfo[]) => {
        for(var i= 0, len= files.length; i < len; ++i) {
          var file = files[i];
          if (file.file && file.diagnostics) {
            var path = directory + file.file;
            this.files.delete(path);
          }
          else if (file.files) {
            rem(file.files);
          }
        }
      }
      rem(olds);
    }
    if (news) {
      var add = (files: FileInfo[], parent: FileInfo) => {
        for(var i= 0, len= files.length; i < len; ++i) {
          var file = files[i];
          file.diagnostics = { set: null, warnings: 0, errors: 0, parent: parent };
          if (file.file) {
            var path = directory + file.file;
            this.files.set(path, file);
          }
          else if (file.files) {
            add(file.files, file);
          }
        }
      }
      add(news, null);
    }
  }

  _incWarning(file: FileInfo, diff) {
    while (file) {
      file.diagnostics.warnings += diff;
      file = file.diagnostics.parent;
    }
  }
  _incError(file: FileInfo, diff) {
    while (file) {
      file.diagnostics.errors += diff;
      file = file.diagnostics.parent;
    }
  }

  add(d: Diagnostic, task: Workspace.Graph) : Diagnostic {
    var item = this.files.get(d.path);
    if (!item)
      this.files.set(d.path, item= { file: d.path, diagnostics: { set: null, warnings: 0, errors: 0, parent: null } });
    if (item.diagnostics.set === null)
      item.diagnostics.set = new Set<any>();

    var merged = null;
    item.diagnostics.set.forEach((diag) => {
      if (merged) return;
      if (diag.row === d.row && diag.col === d.col && diag.msg === d.msg) {
        diag.tasks.add(task);
        merged = diag;
      }
    });
    if (!merged) {
      merged = d;
      item.diagnostics.set.add(d);
      d.tasks = new Set<any>();
      if (d.type === "warning")
        this._incWarning(item, +1);
      else if (d.type === "error")
        this._incError(item, +1);
    }
    this._signal('diagnostic', { diag: d, item: item, action: 'add' });
    return merged;
  }

  remove(d: Diagnostic, task: Workspace.Graph) {
    d.tasks.delete(task);
    if (d.tasks.size === 0) {
      var item = this.files.get(d.path);
      if (item && item.diagnostics.set) {
        item.diagnostics.set.delete(d);
        if (d.type === "warning")
          this._incWarning(item, -1);
        else if (d.type === "error")
          this._incError(item, -1);
      }
    }
    this._signal('diagnostic', { diag: d, item: item, action: 'del' });
  }

  get(p: string) : FileInfo {
    return this.files.get(p);
  }
}
