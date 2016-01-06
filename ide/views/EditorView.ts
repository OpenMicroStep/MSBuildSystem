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

function mktabsize(self, tabwidth, newtabwidth, onChangeTabs) {
  return {
    label: "Tab size: " + newtabwidth,
    type: "radio",
    checked: tabwidth == newtabwidth,
    click: () => { self.file.session.setTabSize(newtabwidth); onChangeTabs(); }
  };
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
    this.editor.setSession(this.file.session);
    //this.editor.setTheme("ace/theme/monokai");
    this.editor.$blockScrolling = Infinity;
    this.editor.setOptions({
      scrollPastEnd: true,
      enableBasicAutocompletion: true,
      enableSnippets: true,
      enableLiveAutocompletion: true
    });

    /// Status bar
    var posEl = document.createElement('div');
    this.statusEl.appendChild(posEl);
    new StatusBar(this.editor, posEl);

    var tabEl = document.createElement('a');
    this.statusEl.appendChild(tabEl);
    var onChangeTabs = () => {
      var session = this.file.session;
      var txt = session.getUseSoftTabs() ? "Spaces: " : "Tabs: ";
      tabEl.textContent = txt += session.getTabSize();
    };
    tabEl.addEventListener("click", (e) => {
      var softtabs = this.file.session.getUseSoftTabs();
      var tabwidth = this.file.session.getTabSize();
      var m = new menu.ContextMenu([
      {
        label: "Indent using spaces",
        type: "checkbox",
        checked: softtabs,
        click: () => { this.file.session.setUseSoftTabs(!softtabs); onChangeTabs(); }
      },
      { type: "separator" },
      mktabsize(this, tabwidth, 2, onChangeTabs),
      mktabsize(this, tabwidth, 4, onChangeTabs),
      mktabsize(this, tabwidth, 6, onChangeTabs),
      mktabsize(this, tabwidth, 8, onChangeTabs),
      { type: "separator" },
      {
        label: "Detect indentation",
        click: () => { this.editor.execCommand("detectIndentation"); onChangeTabs(); }
      },
      { type: "separator" },
      {
        label: "Convert to spaces",
        click: () => { this.editor.execCommand("convertIndentation", { ch: " ", length: tabwidth }); onChangeTabs(); }
      },
      {
        label: "Convert to tabs",
        click: () => { this.editor.execCommand("convertIndentation", { ch: "\t", length: tabwidth }); onChangeTabs(); }
      }
      ]);
      m.popup(e.clientX, e.clientY);
    }, false);
    onChangeTabs();

    var modeEl = document.createElement('a');
    this.statusEl.appendChild(modeEl);
    var onChangeMode = () => {
      modeEl.textContent = this.file.mode.caption;
    };
    this.file.session.on("changeMode", onChangeMode);
    onChangeMode();
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
    ///

    this.file.ref();
    this.titleEl.className = file.saved ? "editorview-title-saved" : "editorview-title-modified";
    file.on("change", this.fileEvt = (e) => {
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
    $(this.statusEl).css({ bottom: h ? 15 : 5, right: v ? 15 : 5 });
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
