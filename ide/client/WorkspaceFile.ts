/// <reference path="../../typings/browser.d.ts" />
/* @flow */
'use strict';

import {globals, events, replication, async} from '../core';
import Workspace = require('./Workspace');

var Document:    typeof AceAjax.Document    = ace.require('ace/document').Document;
var EditSession: typeof AceAjax.EditSession = ace.require("ace/edit_session").EditSession;
var UndoManager: typeof AceAjax.UndoManager = ace.require("ace/undomanager").UndoManager;

// TODO: Make this flexible
var extensionToMode = {
  '.c':'c_cpp',
  '.cpp':'c_cpp',
  '.h': 'objectivec',
  '.hpp': 'c_cpp',
  '.css':'css',
  '.d':'d',
  '.dart':'dart',
  '.diff':'diff',
  '.dockerfile':'dockerfile',
  '.dot':'dot',
  '.gitignore':'gitignore',
  '.go':'golang',
  '.htm':'html',
  '.html':'html',
  '.ini':'ini',
  '.jade':'jade',
  '.js':'javascript',
  '.json':'json',
  '.less':'less',
  '.lisp':'lisp',
  '.lua':'lua',
  'Makefile':'makefile',
  '.md':'markdown',
  '.m':'objectivec',
  '.mm':'objectivec',
  '.sass':'sass',
  '.sh':'sh',
  '.sjs':'sjs',
  '.sql':'sql',
  '.svg':'svg',
  '.tex':'tex',
  '.ts':'typescript',
  '.xml':'xml',
  '.yaml':'yaml',
};

function fileNameToMode(name) {
  var idx = name.lastIndexOf('.');
  if (idx != -1)
    name = name.substring(idx);
  var ext = extensionToMode[name];
  return "ace/mode/" + (ext ? ext : 'text');
}

class WorkspaceFile extends replication.DistantObject {
  refcount: number;
  path:string;
  name:string;
  extension:string;
  session: AceAjax.IEditSession;
  ignoreChanges: boolean;
  workspace: Workspace;
  pendingsdeltas: async.Flux[];

  constructor() {
    super();

    this.refcount = 1;
    this.pendingsdeltas = [];
    this.session = new EditSession("", null);
    this.session.on("change", (e) => {
      if (!this.ignoreChanges) {
        (new async.Async({ deltas: [e.data] } , [
          (p) => {
            this.pendingsdeltas.push(p);
            p.continue();
          },
          (p) => { this.change(p, { deltas: p.context.deltas }); },
          (p) => {
            var i = this.pendingsdeltas.lastIndexOf(p);
            if (i !== -1) this.pendingsdeltas.splice(i, 1);
            p.continue();
          }
        ])).continue();
        setTimeout(() => { this._signal("change"); }, 0);
      }
    });
    this.on('extchange', (e) => {
      // another client changed the content
      this.ignoreChanges = true;
      this.session.getDocument().applyDeltas(e.deltas);
      this.ignoreChanges = false;
      setTimeout(() => { this._signal("change"); }, 0);
    });
    this.on('extsaved', (e) => { this.saved(e); });
    this.ignoreChanges = true;
  }

  initWithData(data) {
    this.ignoreChanges = true;
    this.path = data.path;
    this.name = data.name;
    this.extension = data.extension;
    this.session.setMode(fileNameToMode(data.name));
    this.session.setValue(data.content);
    this.session.setUndoManager(new UndoManager());
    this.session.getDocument().applyDeltas(data.deltas);
    this.ignoreChanges = false;
  }

  reconnect(data) {
    this.ignoreChanges = true;
    this.session.setValue(data.content);
    this.session.getUndoManager().reset();
    this.session.getDocument().applyDeltas(data.deltas);
    this.pendingsdeltas.forEach((p) => {
      p.setEndCallbacks((p) => {
        this.ignoreChanges = true;
        this.session.getDocument().applyDeltas(p.context.deltas);
        this.ignoreChanges = false;
      });
    });
  }

  outofsync(p: async.Flux) {
    p.setFirstElements((p) => {
      var file = p.context.result;
      if (file !== this) {
        this.changeId(file.id);
        console.warn("The server has a different version, propose to the user to save his version");
        file.destroy();
      }
      else p.continue();
    });
    this.workspace.remoteCall(p, "openFile", this.path);
  }

  ref() {
    ++this.refcount;
  }

  unref() {
    if (--this.refcount === 0) {
      this.destroy();
    }
  }

  hasUnsavedChanges() {
    return !this.session.getUndoManager().isClean();
  }

  save(p: async.Flux) {
    var content = this.session.getValue();
    p.setFirstElements((p) => {
      if (p.context.result)
        this.saved({ version: p.context.result.version, content: content });
    });
    this.remoteCall(p, "save", content);
  }

  saved(e) {
    if (this.session.getValue() !== e.content) {
      console.warn("TODO: synchronize on saved");
      this.ignoreChanges = true;
      this.session.setValue(e.content);
      this.ignoreChanges = false;
    }
    setTimeout(() => {
      this.session.getUndoManager().markClean();
      this._signal("change");
    }, 0);
  }

  change(p, e) {
    this.remoteCall(p, "change", e);
  }
}
replication.registerClass("WorkspaceFile", WorkspaceFile);

export = WorkspaceFile;

