/// <reference path="../../typings/browser.d.ts" />
/* @flow */
'use strict';

import replication = require('./replication');
import Workspace = require('./Workspace');

var Document:  typeof AceAjax.Document = ace.require('ace/document').Document;

class WorkspaceFile extends replication.DistantObject {
  path:string;
  name:string;
  extension:string;
  version:number;
  document: AceAjax.Document;
  ignoreChanges: boolean;

  constructor(public workspace: Workspace) {
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
  }

  outofsync() {
    return this.workspace.openFile(this.path)
      .then((file : WorkspaceFile) => {
        this.changeId(file.id);
        // TODO, compare contents
      });
  }

  save() : Promise<boolean> {
    return this.remoteCall("save", this.document.getValue());
  }

  change(version, data) {
    if (version == this.version + 1) {
      this.document.applyDeltas([data]);
      this.version = version;
    }
  }

  edit(data: {action: string, range:any, lines?, text?, nl?}) : Promise<boolean> {
    return this.remoteCall("change", ++this.version, data);
  }
}
replication.registerClass("WorkspaceFile", WorkspaceFile);

export = WorkspaceFile;

