/// <reference path="../../typings/browser.d.ts" />
/* @flow */
'use strict';

import {globals, events, replication, async} from '../core';
import Workspace = require('./Workspace');
import Async = async.Async;

var Document    = ace.require('ace/document').Document;
var EditSession = ace.require("ace/edit_session").EditSession;
var UndoManager = ace.require("ace/undomanager").UndoManager;
var modelist = ace.require("ace/ext/modelist");
var lang = ace.require("ace/lib/lang");

class UndoManagerProxy {
  $u; $session;
  constructor(undoManager, session) {
    this.$u = undoManager;
    this.$session = session;
  }
  execute(options) {
    this.$u.execute(options);
  }

  undo(dontSelect) {
    var selectionRange = this.$u.undo(dontSelect);
    if (selectionRange)
      this.$session.selection.setSelectionRange(selectionRange);
  }

  redo(dontSelect) {
    var selectionRange = this.$u.redo(dontSelect);
    if (selectionRange)
      this.$session.selection.setSelectionRange(selectionRange);
  }

  reset() {
    this.$u.reset();
  }

  hasUndo() {
    return this.$u.hasUndo();
  }

  hasRedo() {
    return this.$u.hasRedo();
  }
}

/*
    this.session.setUndoManager(new UndoManager());
    this.session = new EditSession("", null);
*/
class WorkspaceFile extends replication.DistantObject {
  refcount: number;
  path:string;
  name:string;
  mode: { mode: string, name: string, caption: string };
  extension:string;
  document: AceAjax.Document;
  private undomanager;
  private session;
  ignoreChanges: boolean;
  pendingsdeltas: Async[];
  $informChange;

  constructor() {
    super();
    this.refcount = 1;
    this.pendingsdeltas = [];
    this.document = new Document("");
    this.undomanager = new UndoManager();
    this.session = new EditSession(this.document, null);
    this.session.setUndoManager(this.undomanager);
    this.mode = null;
    this.ignoreChanges = true;

    this.document.on("change", (e) => {
      if (!this.ignoreChanges) {
        var once= new Async({ deltas: [e] }, Async.once((p) => { this.change(p, { deltas: p.context.deltats }); }));
        Async.run(null, [
          (p) => {
            this.pendingsdeltas.push(once);
            p.continue();
          },
          once,
          (p) => {
            var i = this.pendingsdeltas.lastIndexOf(once);
            if (i !== -1) this.pendingsdeltas.splice(i, 1);
            p.continue();
          }
        ]);
      }
      this.$informChange.schedule();
    });
    this.on('extchange', (e) => {
      // another client changed the content
      this.ignoreChanges = true;
      this.document.applyDeltas(e.deltas);
      this.ignoreChanges = false;
      this.$informChange.schedule();
    });
    this.on('extsaved', (e) => { this.saved(e); });
    this.$informChange = lang.delayedCall(() => { setTimeout(() => { this._signal("change"); }, 0); });
  }

  initWithData(data) {
    this.ignoreChanges = true;
    this.path = data.path;
    this.name = data.name;
    this.extension = data.extension;
    this.setMode(modelist.getModeForPath(data.name) || modelist.modesByName["text"]);
    this.session.setValue(data.content);
    this.document.applyDeltas(data.deltas);
    this.ignoreChanges = false;
  }

  createEditSession() {
    var session = new EditSession(<any>this.document, this.session.getMode());
    session.setUndoManager = function(undoManager) {
      this.$undoManager = undoManager;
      this.$deltas = [];
      this.$deltasDoc = [];
      this.$deltasFold = [];

      if (this.$informUndoManager)
          this.$informUndoManager.cancel();

      if (undoManager) {
          var self = this;

          this.$syncInformUndoManager = function() {
              self.$informUndoManager.cancel();
              self.$deltasFold = [];
              self.$deltasDoc = [];
              self.mergeUndoDeltas = false;
              self.$deltas = [];
          };
          this.$informUndoManager = lang.delayedCall(this.$syncInformUndoManager);
      }
    }
    session.setUndoManager(new UndoManagerProxy(this.undomanager, session));
    session.setOptions(this.session.getOptions());
    var evt;
    this.on('changeOptions', evt = (e) => {
      session.setOptions(e.options);
    });
    var prev = session.destroy;
    var self = this;
    session.destroy = function() {
      self.off('changeOptions', evt);
      prev.apply(this, arguments);
    };
    return session;
  }

  setMode(mode) {
    this.mode = mode;
    this.setOptions({ 'mode': mode.mode });
  }
  getOption(key) {
    return this.session.getOption(key);
  }
  getOptions() {
    return this.session.getOptions();
  }
  setOptions(options) {
    this.session.setOptions(options);
    this._signal('changeOptions', { options: options });
  }

  reconnect(data) {
    this.ignoreChanges = true;
    this.document.setValue(data.content);
    this.undomanager.reset();
    this.document.applyDeltas(data.deltas);
    this.pendingsdeltas.forEach((once) => {
      Async.run(null, [
        once,
        (p) => {
          this.ignoreChanges = true;
          this.document.applyDeltas(once.context.deltas);
          this.ignoreChanges = false;
        }
      ]);
    });
  }

  outofsync(p: async.Async) {
    p.setFirstElements((p) => {
      var file = p.context.result;
      if (file !== this) {
        this.changeId(file.id);
        console.warn("The server has a different version, propose to the user to save his version");
        file.destroy();
      }
      else p.continue();
    });
    globals.ide.workspace.remoteCall(p, "openFile", this.path);
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
    return !this.undomanager.isClean();
  }

  save(p: async.Async) {
    var content = this.document.getValue();
    p.setFirstElements((p) => {
      if (p.context.result)
        this.saved({ version: p.context.result.version, content: content });
      p.continue();
    });
    this.remoteCall(p, "save", content);
  }

  saved(e) {
    if (this.document.getValue() !== e.content) {
      console.warn("TODO: synchronize on saved");
      this.ignoreChanges = true;
      this.session.setValue(e.content);
      this.ignoreChanges = false;
    }
    setTimeout(() => {
      this.undomanager.markClean();
      this._signal("change");
      this._signal("saved");
    }, 0);
  }

  change(p, e) {
    this.remoteCall(p, "change", e);
  }
}
replication.registerClass("WorkspaceFile", WorkspaceFile);

export = WorkspaceFile;

