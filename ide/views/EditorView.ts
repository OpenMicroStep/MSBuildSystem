/// <reference path="../../typings/browser.d.ts" />
"use strict";
import {View, ContentView, async} from '../core';
import WorkspaceFile = require('../client/WorkspaceFile');
import Workspace = require('../client/Workspace');

var Editor = ace.require("ace/editor").Editor;
var EditSession = ace.require("ace/edit_session").EditSession;
var Renderer = ace.require("ace/virtual_renderer").VirtualRenderer;
var StatusBar = ace.require("ace/ext/statusbar").StatusBar;
ace.require("ace/ext/language_tools");

class EditorView extends ContentView {
  file: WorkspaceFile; fileEvt;
  editor: AceAjax.Editor;
  editorEl: HTMLElement;
  statusEl: HTMLElement;

  constructor(file: WorkspaceFile) {
    super();
    this.file = file;
    this.titleEl.textContent = file.name;

    this.editorEl = document.createElement('div');
    this.statusEl = document.createElement('div');
    this.el.appendChild(this.editorEl);
    this.el.appendChild(this.statusEl);
    this.el.className = "editor";
    this.editorEl.className = "editor-ace";
    this.statusEl.className = "editor-status";
    this.editor = new Editor(new Renderer(this.editorEl));
    this.editor.setSession(this.file.session);
    this.editor.setTheme("ace/theme/monokai");
    this.editor.$blockScrolling = Infinity;
    this.editor.setOptions({
      scrollPastEnd: true,
      enableBasicAutocompletion: true,
      enableSnippets: true,
      enableLiveAutocompletion: true
    });
    this.file.ref();
    this.titleEl.className = file.saved ? "editorview-title-saved" : "editorview-title-modified";
    file.on("change", this.fileEvt = (e) => {
      console.log("change", this.file.hasUnsavedChanges());
       this.titleEl.className = !this.file.hasUnsavedChanges() ? "editorview-title-saved" : "editorview-title-modified";
    });
    file.workspace.on("diagnostic", this.ondiagnostics.bind(this));
  }

  isViewFor(file) {
    return this.file === file;
  }

  ondiagnostics(e: {diag: Workspace.Diagnostic}) {
    if (e.diag && e.diag.path === this.file.path)
      this.loadDiagnostics();
  }

  loadDiagnostics() {
    var diags = this.file.workspace.diagnosticsAtPath(this.file.path);
    var session = this.editor.session;
    var annotations = [];
    diags.forEach((d) => {
      annotations.push({
        row: d.row - 1,
        column: d.col - 1,
        text: d.msg,
        type: d.type
      })
    });
    session.setAnnotations(annotations);
  }

  destroy() {
    super.destroy();
    this.editor.destroy();
    this.file.unref();
    this.file.off("saved", this.fileEvt);
  }

  tryDoAction(command) {
    switch (command.name) {
      case 'file.save':
        async.run(null, this.file.save.bind(this.file));
        return true;
    }
    return super.tryDoAction(command);
  }

  focus() {
    this.editor.focus();
    super.focus();
  }

  showContextMenu() {

  }
  resize() {
    this.editor.resize();
  }

  decode(s : EditorView.SerializedEditor) {
    // s.type === (<any>this.constructor).name
    this.editor.setOptions(s.options);
  }
  encode() : EditorView.SerializedEditor {
    var r = <EditorView.SerializedEditor>super.encode();
    r.path = "";
    r.options = this.editor.getOptions();
    return r;
  }
}

module EditorView {
  export interface SerializedEditor extends View.SerializedView {
    path: string;
    options: any;
  }
}

export = EditorView;
