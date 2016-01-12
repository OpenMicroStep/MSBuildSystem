/// <reference path="../../typings/browser.d.ts" />
"use strict";
import {View, ContentView, async, menu} from '../core';
import WorkspaceFile = require('../client/WorkspaceFile');
import Workspace = require('../client/Workspace');

var Editor = ace.require("ace/editor").Editor;
var EditSession = ace.require("ace/edit_session").EditSession;
var Renderer = ace.require("ace/virtual_renderer").VirtualRenderer;
var StatusBar = ace.require("ace/ext/statusbar").StatusBar;
var whitespace = ace.require("ace/ext/whitespace");
var modelist = ace.require("ace/ext/modelist");

function mktabsize(self, tabwidth, newtabwidth) {
  return {
    label: "Tab size: " + newtabwidth,
    type: "radio",
    checked: tabwidth == newtabwidth,
    click: () => { self.file.setOptions({ 'tabSize': newtabwidth }); }
  };
}

function convertIndentation(self, useSoftTabs, tabSize) {
  self.editor.execCommand("convertIndentation", { ch: useSoftTabs ? " " : "\t", length: tabSize });
  self.file.setOptions({
    useSoftTabs: useSoftTabs,
    tabSize: tabSize
  });
}

function detectIndentation(self) {
  self.editor.execCommand("detectIndentation");
  self.file.setOptions({
    useSoftTabs: self.editor.session.getOption('useSoftTabs'),
    tabSize: self.editor.session.getOption('tabSize')
  });
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
    this.editor = new Editor(new Renderer(this.editorEl));
    this.editor.commands.addCommands(whitespace.commands);
    this.editor.setSession(this.file.createEditSession());
    //this.editor.setTheme("ace/theme/monokai");
    this.editor.$blockScrolling = Infinity;
    this.editor.setOptions({
      scrollPastEnd: true,
      enableBasicAutocompletion: true,
      enableSnippets: true,
      enableLiveAutocompletion: true
    });

    /// Status bar
    var onChangeOptions = () => {
      var session = this.editor.session;
      var txt = session.getUseSoftTabs() ? "Spaces: " : "Tabs: ";
      tabEl.textContent = txt += session.getTabSize();
      modeEl.textContent = this.file.mode.caption;
    };

    var posEl = document.createElement('div');
    this.statusEl.appendChild(posEl);
    new StatusBar(this.editor, posEl);

    var tabEl = document.createElement('a');
    this.statusEl.appendChild(tabEl);
    tabEl.addEventListener("click", (e) => {
      var softtabs = this.editor.session.getUseSoftTabs();
      var tabwidth = this.editor.session.getTabSize();
      var m = new menu.ContextMenu([
      {
        label: "Indent using spaces",
        type: "checkbox",
        checked: softtabs,
        click: () => { this.file.setOptions({ "useSoftTabs": !softtabs }); }
      },
      { type: "separator" },
      mktabsize(this, tabwidth, 2),
      mktabsize(this, tabwidth, 4),
      mktabsize(this, tabwidth, 6),
      mktabsize(this, tabwidth, 8),
      { type: "separator" },
      {
        label: "Detect indentation",
        click: () => { detectIndentation(this); }
      },
      { type: "separator" },
      {
        label: "Convert to spaces",
        click: () => { convertIndentation(this, true,  tabwidth); }
      },
      {
        label: "Convert to tabs",
        click: () => { convertIndentation(this, false, tabwidth); }
      }
      ]);
      m.popup(e.clientX, e.clientY);
    }, false);

    var modeEl = document.createElement('a');
    this.statusEl.appendChild(modeEl);
    modeEl.addEventListener("click", (e) => {
      var m = new menu.ContextMenu(modelist.modes.map((mode) => {
        return {
          label: mode.caption,
          click: () => { this.file.setMode(mode); }
        };
      }));
      m.popup(e.clientX, e.clientY);
    }, false);

    var settingsEl = document.createElement('a');
    $('<span class="fa fa-cog fa-lg"></span>').appendTo(settingsEl);
    this.statusEl.appendChild(settingsEl);
    (<any>this.editor.renderer).on('scrollbarVisibilityChanged', this.onscrollbarVisibilityChanged.bind(this));
    this.onscrollbarVisibilityChanged();
    this.file.on('changeOptions', onChangeOptions);
    onChangeOptions();
    ///

    this.file.ref();
    this.titleEl.className = file.saved ? "editorview-title-saved" : "editorview-title-modified";
    file.on("change", this.fileEvt = (e) => {
      this.titleEl.className = !this.file.hasUnsavedChanges() ? "editorview-title-saved" : "editorview-title-modified";
    });
    Workspace.diagnostics.on("diagnostic", this.ondiagnostics.bind(this));
    this.loadDiagnostics();
  }

  isViewFor(file) {
    return this.file === file;
  }

  ondiagnostics(e: {diag: Workspace.Diagnostic}) {
    if (e.diag && e.diag.path === this.file.path)
      this.loadDiagnostics();
  }

  loadDiagnostics() {
    var info = Workspace.diagnostics.get(this.file.path);
    var session = this.editor.session;
    var annotations = [];
    if (info && info.diagnostics && info.diagnostics.set) {
      info.diagnostics.set.forEach((d) => {
        annotations.push({
          row: d.row - 1,
          column: d.col - 1,
          text: d.msg,
          type: d.type
        })
      });
    }
    session.setAnnotations(annotations);
  }

  destroy() {
    super.destroy();
    this.editor.destroy();
    this.file.unref();
    this.file.off("change", this.fileEvt);
  }

  tryDoAction(command) {
    if (command.name.startsWith('editor.ace.')) {
      this.editor.execCommand(command.name.substring('editor.ace.'.length));
      return true;
    }
    switch (command.name) {
      case 'file.save':
        whitespace.trimTrailingSpace(this.editor.session, true);
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
  onscrollbarVisibilityChanged() {
    var h = (<any>this.editor.renderer).scrollBarH.isVisible;
    var v = (<any>this.editor.renderer).scrollBarV.isVisible;
    $(this.statusEl)
      .toggleClass('editor-status-padh', h)
      .toggleClass('editor-status-padv', v);
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

EditorView.prototype.duplicate = function() {
  return new EditorView(this.file);
}

module EditorView {
  export var Range: typeof AceAjax.Range = ace.require("ace/range").Range;
  export interface SerializedEditor extends View.SerializedView {
    path: string;
    options: any;
  }
  export class SimpleEditorView extends View {
    editor: AceAjax.Editor;

    constructor() {
      super();
      this.editor = ace.edit(this.el);
    }

    resize() {
      this.editor.resize();
    }

    destroy() {
      super.destroy();
      this.editor.destroy();
    }
  }
}

export = EditorView;
