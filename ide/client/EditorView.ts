/// <reference path="../../typings/browser.d.ts" />
"use strict";
import View = require('./View');
import ContentView = require('./ContentView');
import WorkspaceFile = require('./WorkspaceFile');

var StatusBar = ace.require("ace/ext/statusbar").StatusBar;
ace.require("ace/ext/language_tools");

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
  return ext ? ext : 'text';
}

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
    this.editor = ace.edit(this.editorEl);
    var session = ace.createEditSession(<any>file.document, <any>"ace/mode/" + fileNameToMode(file.name));
    var oldsession:any = this.editor.session;
    this.editor.setSession(session);
    oldsession.destroy();
    //this.editor.session.setDocument(file.document);
    //this.editor.session.setMode(<any>"ace/mode/" + fileNameToMode(file.name));
    this.editor.setTheme("ace/theme/monokai");
    this.editor.$blockScrolling = Infinity;
    this.editor.setOptions({
      scrollPastEnd: true,
      enableBasicAutocompletion: true,
      enableSnippets: true,
      enableLiveAutocompletion: true
    });
    //new StatusBar(this.editor, this.statusEl);

    this.titleEl.className = file.saved ? "editorview-title-saved" : "editorview-title-modified";
    file.on("saved", this.fileEvt = (e) => {
       this.titleEl.className = !e.hasUnsavedChanges ? "editorview-title-saved" : "editorview-title-modified";
    });
  }

  destroy() {
    super.destroy();
    this.editor.destroy();
    this.file.off("saved", this.fileEvt);
  }
/*
  tryDoAction(command): boolean {
    this.editor.execCommand(e.name);
    return false;
  }*/

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
