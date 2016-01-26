import {View, ContentView, async, menu, globals} from '../core';
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
  path: string;
  _file: WorkspaceFile; fileEvt;
  _once;
  editor: AceAjax.Editor;
  editorEl: HTMLElement;
  statusEl: HTMLElement;
  $onChangeOptions;

  constructor(opts: { path: string }) {
    super();

    this.path = opts.path;
    this._file = null;
    this.editorEl = document.createElement('div');
    this.statusEl = document.createElement('div');
    this.el.appendChild(this.editorEl);
    this.el.appendChild(this.statusEl);
    this.el.className = "editor";
    this.editorEl.className = "editor-ace";
    this.statusEl.className = "editor-status";
    this.editor = new Editor(new Renderer(this.editorEl));
    this.editor.commands.addCommands(whitespace.commands);
    this.editor.$blockScrolling = Infinity;
    this.editor.setOptions({
      scrollPastEnd: true,
      enableBasicAutocompletion: true,
      enableSnippets: true,
      enableLiveAutocompletion: true
    });

    /// Status bar
    this.$onChangeOptions = () => {
      var session = this.editor.session;
      var txt = session.getUseSoftTabs() ? "Spaces: " : "Tabs: ";
      tabEl.textContent = txt += session.getTabSize();
      modeEl.textContent = this._file.mode.caption;
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
        click: () => { this._file.setOptions({ "useSoftTabs": !softtabs }); }
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
          click: () => { this._file.setMode(mode); }
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

    async.run(null, this._once = async.Async.once([
      (p) => { globals.ide.session.openFile(p, this.path); },
      (p) => {
        var file = p.context.file;
        if (file)
          this.initWithFile(file);
        p.continue();
      }
    ]));
  }

  initWithFile(file) {
    this._file = file;
    this.titleEl.textContent = file.name;

    this.editor.setSession(this._file.createEditSession());
    //this.editor.setTheme("ace/theme/monokai");

    this._file.ref();
    this.titleEl.className = file.saved ? "editorview-title-saved" : "editorview-title-modified";
    file.on("change", this.fileEvt = (e) => {
      this.titleEl.className = !this._file.hasUnsavedChanges() ? "editorview-title-saved" : "editorview-title-modified";
    });
    this._file.on('changeOptions', this.$onChangeOptions);
    this.$onChangeOptions();
    Workspace.diagnostics.on("diagnostic", this.ondiagnostics.bind(this));
    this.loadDiagnostics();
  }

  getFile(p: async.Async) {
    p.setFirstElements([
      this._once,
      (p) => { p.context.file = this._file; }
    ]);
  }

  isViewFor(opts) {
    return opts && this.path === opts.path;
  }

  ondiagnostics(e: {diag: Workspace.Diagnostic}) {
    if (e.diag && e.diag.path === this._file.path)
      this.loadDiagnostics();
  }

  loadDiagnostics() {
    var info = Workspace.diagnostics.get(this._file.path);
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
    this._file.unref();
    this._file.off("change", this.fileEvt);
  }

  tryDoAction(p, command) {
    if (command.name.startsWith('editor.ace.')) {
      this.editor.execCommand(command.name.substring('editor.ace.'.length));
      return true;
    }
    switch (command.name) {
      case 'file.save':
        this._file.save(p);
        return true;
      case 'edit.redo':
        this.editor.execCommand("redo");
        return true;
      case 'edit.undo':
        this.editor.execCommand("undo");
        return true;
    }
    return super.tryDoAction(p, command);
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

  data() {
    return { path: this.path };
  }
  dragndrop() {
    return {
      data: this.serialize(),
      file: this.path
    };
  }
}

EditorView.prototype.duplicate = function() {
  return new EditorView(this.path);
}

ContentView.register(EditorView, "editor");

module EditorView {
  export var Range: typeof AceAjax.Range = ace.require("ace/range").Range;
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
