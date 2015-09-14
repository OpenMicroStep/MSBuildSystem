/// <reference path="../../typings/browser.d.ts" />
/* @flow */
'use strict';

import replication = require('./replication');
import Workspace = require('./Workspace');
import events = require("./events");
import globals = require('./globals');

var Document:  typeof AceAjax.Document = ace.require('ace/document').Document;

class WorkspaceFile extends replication.DistantObject implements events.EventEmitter {
  listeners: { [s:string]: ((...args) => any)[] } = {};
  on: (event, callme) => void;
  once: (event, callmeonce) => void;
  emit: (event, ...args) => void;
  removeListener: (event, callme) => void;

  path:string;
  name:string;
  extension:string;
  version:number;
  document: AceAjax.Document;
  ignoreChanges: boolean;
  saved: boolean;
  workspace: Workspace;

  constructor() {
    super();

    this.document = new Document("");
    this.document.on("change", (e) => {
      if (!this.ignoreChanges) {
        this.edit(e.data);
      }
    });
    this.ignoreChanges = true;
  }

  initWithData(data) {
    this.ignoreChanges = true;
    this.path = data.path;
    this.name = data.name;
    this.extension = data.extension;
    this.version = data.version;
    this.document.setValue(data.content);
    this.document.applyDeltas(data.deltas);
    this.ignoreChanges = false;
    this.saved = data.deltas.length == 0;
  }

  outofsync() {
    return this.workspace.openFile(this.path)
      .then((file : WorkspaceFile) => {
        this.changeId(file.id);
        // TODO, compare contents
      });
  }

  save() : Promise<boolean> {
    return this.remoteCall("save", this.document.getValue()).then((ok) => {
      this.emit("saved", ok);
      this.saved = ok;
      return ok;
    });
  }

  change(version, data) {
    if (version == this.version + 1) {
      this.document.applyDeltas([data]);
      this.version = version;
    }
  }

  edit(data: {action: string, range:any, lines?, text?, nl?}) : Promise<boolean> {
    this.emit("saved", false);
    return this.remoteCall("change", ++this.version, data);
  }
}
replication.registerClass("WorkspaceFile", WorkspaceFile);
events.mixin(WorkspaceFile);

export = WorkspaceFile;

