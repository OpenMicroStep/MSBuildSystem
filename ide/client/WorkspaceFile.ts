/// <reference path="../../typings/browser.d.ts" />
/* @flow */
'use strict';

import {globals, events, replication, async} from '../core';
import Workspace = require('./Workspace');

var Document:    typeof AceAjax.Document    = ace.require('ace/document').Document;
var EditSession: typeof AceAjax.EditSession = ace.require("ace/edit_session").EditSession;
var UndoManager: typeof AceAjax.UndoManager = ace.require("ace/undomanager").UndoManager;
var modelist = ace.require("ace/ext/modelist");

class WorkspaceFile extends replication.DistantObject {
  refcount: number;
  path:string;
  name:string;
  extension:string;
  session: AceAjax.IEditSession;
  ignoreChanges: boolean;
  workspace: Workspace;
  mode: { mode: string, name: string, caption: string };
  pendingsdeltas: async.Flux[];

  constructor() {
    super();
    this.refcount = 1;
    this.pendingsdeltas = [];
    this.session = new EditSession("", null);
    this.ignoreChanges = true;
    this.mode = null;

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
  }

  initWithData(data) {
    this.ignoreChanges = true;
    this.path = data.path;
    this.name = data.name;
    this.extension = data.extension;
    this.setMode(modelist.getModeForPath(data.name) || modelist.modesByName["text"]);
    this.session.setValue(data.content);
    this.session.setUndoManager(new UndoManager());
    this.session.getDocument().applyDeltas(data.deltas);
    this.ignoreChanges = false;
  }

  setMode(mode) {
    this.mode = mode;
    this.session.setMode(mode.mode);
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

