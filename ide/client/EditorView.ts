/// <reference path="../../typings/browser.d.ts" />
"use strict";
import View = require('./View');
import ContentView = require('./ContentView');
import WorkspaceFile = require('./WorkspaceFile');

class EditorView extends ContentView {
  file: WorkspaceFile;
  editor: AceAjax.Editor;

  constructor(file: WorkspaceFile) {
    super();
    this.file = file;
    this.titleEl.textContent = file.name;

    this.el.className = "editor";

    this.editor = ace.edit(this.el);
    var session = ace.createEditSession(<any>file.document, <any>"ace/mode/objectivec");
    this.editor.setSession(session);
    this.editor.setTheme("ace/theme/monokai");
    this.editor.$blockScrolling = Infinity;
    this.editor.setOptions({
      scrollPastEnd: true
    });
    this.titleEl.className = file.saved ? "editorview-title-saved" : "editorview-title-modified";
    file.on("saved", (saved) => {
       this.titleEl.className = saved ? "editorview-title-saved" : "editorview-title-modified";
    });
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
