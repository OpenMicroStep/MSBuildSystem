import {View, ContentView, async, menu, globals, util} from '../core';
import WorkspaceFile = require('../client/WorkspaceFile');
import Workspace = require('../client/Workspace');
import Dialog = require('./Dialog');

var Editor = ace.require("ace/editor").Editor;
var EditSession = ace.require("ace/edit_session").EditSession;
var Renderer = ace.require("ace/virtual_renderer").VirtualRenderer;
var StatusBar = ace.require("ace/ext/statusbar").StatusBar;
var whitespace = ace.require("ace/ext/whitespace");
var modelist = ace.require("ace/ext/modelist");
var config = ace.require("ace/config");

var previousIsTabStop = EditSession.prototype.isTabStop;
EditSession.prototype.isTabStop = function() {
  return !this.$noTabStop && previousIsTabStop.apply(this, arguments);
}
config.defineOptions(Editor.prototype, "editor", {
  noTabStop: "session",
});
config.defineOptions(EditSession.prototype, "session", {
  noTabStop: {initialValue: true},
});

function mktabsize(self, tabwidth, newtabwidth) {
  return {
    label: "Tab size: " + newtabwidth,
    type: "radio",
    checked: tabwidth == newtabwidth,
    click: () => { if (self._file) self._file.setOptions({ 'tabSize': newtabwidth }); }
  };
}

function convertIndentation(self, useSoftTabs, tabSize) {
  if (!self._file) return;
  self.editor.execCommand("convertIndentation", { ch: useSoftTabs ? " " : "\t", length: tabSize });
  self._file.setOptions({
    useSoftTabs: useSoftTabs,
    tabSize: tabSize
  });
}

function detectIndentation(self) {
  if (!self._file) return;
  self.editor.execCommand("detectIndentation");
  self._file.setOptions({
    useSoftTabs: self.editor.session.getOption('useSoftTabs'),
    tabSize: self.editor.session.getOption('tabSize')
  });
}

var _onEditorOptionChangeList: any[] = null;
function onEditorOptionChange(cb: (options) => void) {
  if (!_onEditorOptionChangeList) {
    globals.ide.session.onSet(['settings', 'ace-editor'], function(options) {
      _onEditorOptionChangeList.forEach(function(cb) { cb(options); });
    }, {});
    _onEditorOptionChangeList = [];
  }
  _onEditorOptionChangeList.push(cb);
  cb(globals.ide.session.get(['settings', 'ace-editor'], {}));
}
function offEditorOptionChange(cb: (options) => void) {
  var idx = _onEditorOptionChangeList.indexOf(cb);
  if (idx !== -1)
    _onEditorOptionChangeList.splice(idx, 1);
}

class EditorView extends ContentView {
  path: string;
  _file: WorkspaceFile; fileChgEvt; fileUsrEvt;
  _once;
  editor: AceAjax.Editor;
  editorEl: HTMLElement;
  statusEl: HTMLElement;
  fileOptChgEvt; $onEdChangeOptions; $ondiagnostics;
  _onceVisible;

  constructor(opts: { path: string, row?: number, col?: number }) {
    super(undefined, undefined, true);

    this.path = opts.path;
    this._file = null;
    this._onceVisible = null;
    this.editorEl = document.createElement('div');
    this.statusEl = document.createElement('div');
    this.el.appendChild(this.editorEl);
    this.el.appendChild(this.statusEl);
    this.el.className = "editor";
    this.editorEl.className = "editor-ace";
    this.statusEl.className = "editor-status";
    this.titleEl.textContent = util.pathBasename(this.path);
    this.titleEl.className = "tablayout-content-loading";
    //$('<i class="fa fa-circle-o-notch fa-spin"></i>').appendTo(this.titleEl);
    this.editor = new Editor(new Renderer(this.editorEl));
    this.editor.commands.addCommands(whitespace.commands);
    this.editor.$blockScrolling = Infinity;
    this.editor.setOptions({
      enableSnippets: true,
    });
    onEditorOptionChange(this.$onEdChangeOptions = (options) => {
      this.editor.setOptions(options);
    });

    /// Status bar
    this.fileOptChgEvt = () => {
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
        click: () => { if (this._file) this._file.setOptions({ "useSoftTabs": !softtabs }); }
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
    if (opts.row !== void 0)
      this.goTo(opts);
  }

  initWithFile(file) {
    if (!this.editor) return;
    this._file = file;
    this.titleEl.textContent = file.name;
    this.titleEl.className = "";

    this.editor.setSession(this._file.createEditSession());
    //this.editor.setTheme("ace/theme/monokai");

    this._file.ref();
    this.titleEl.className = file.saved ? "editorview-title-saved" : "editorview-title-modified";
    this._file.on("change", this.fileChgEvt = (e) => {
      this.titleEl.className = !this._file.hasUnsavedChanges() ? "editorview-title-saved" : "editorview-title-modified";
    });
    this._file.on("useraction", this.fileUsrEvt = (e) => {
      this.onceVisible(this.onUserActionRequested.bind(this, e));
    });
    this._file.on("changeOptions", this.fileOptChgEvt);
    this.fileOptChgEvt();
    globals.ide.session.diagnostics.on("diagnostic", this.$ondiagnostics= this.ondiagnostics.bind(this));
    this.loadDiagnostics();
    this.fileChgEvt(null);
    this._signal("ready");
  }

  onceVisible(cb: ()=> void) {
    if (this.isVisible())
      cb();
    else
      this._onceVisible = cb;
  }

  show() {
    if (this._onceVisible) {
      this._onceVisible();
    }
    super.show();
  }

  ready(p) {
    if (this._file) p.continue();
    else this.once("ready", p.continue.bind(p));
  }

  goTo(opts: { row?: number, col?: number }) {
    if (opts.row === void 0) return;
    if (this._file)
      this.editor.gotoLine(opts.row + 1, opts.col);
    else
      this.once("ready", () => { setTimeout(() => { this.editor.gotoLine(opts.row + 1, opts.col); }, 0); });
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

  onUserActionRequested(e) {
    if (e.fixed) return;
    e.fixed = true;
    var opt;
    if (e.reason === "outofsync") {
      opt = {
        title: "Content differ with server after reconnection",
        primary: "Keep current working version",
        secondary: "Use the server version"
      }
    }
    else {
      opt = {
        title: "File has changed and you have local changes",
        primary: "Keep current working version",
        secondary: "Use the changed version"
      }
    }
    var dlg = new Dialog(opt);
    dlg.appendTo(this.el);
    dlg.modal((r) => {
      e.solution(r.action === "secondary" ? e.proposition : null);
    });
    this._onceVisible = null;
  }

  loadDiagnostics() {
    var diagnostics = globals.ide.session.diagnostics.byPath.get(this._file.path);
    var session = this.editor.session;
    var annotations = [];
    if (diagnostics) {
      diagnostics.forEach((d) => {
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
    globals.ide.session.diagnostics.off("diagnostic", this.$ondiagnostics);
    this.editor.destroy();
    offEditorOptionChange(this.$onEdChangeOptions);
    this.editor = null;
    if (this._file) {
      this._file.unref();
      this._file.off("change", this.fileChgEvt);
      this._file.off("useraction", this.fileUsrEvt);
      this._file.off("changeOptions", this.fileOptChgEvt);
    }
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
    var pos = this.editor.getCursorPosition();
    return { path: this.path, row: pos.row, col: pos.column };
  }
  dragndrop() {
    return {
      data: this.serialize(),
      file: this.path
    };
  }
}

EditorView.prototype.duplicate = function() {
  return new EditorView(this.data());
}

ContentView.register(EditorView, "editor");

module EditorView {
  export var Range: typeof AceAjax.Range = ace.require("ace/range").Range;
  export class SimpleEditorView extends View {
    editor: AceAjax.Editor; $onEdChangeOptions;

    constructor(options?: { content?: string }) {
      super();
      this.el.className += "fill";
      this.editor = ace.edit(this.el);
      this.editor.$blockScrolling = Infinity;
      onEditorOptionChange(this.$onEdChangeOptions = (options) => {
        this.editor.setOptions(options);
      });
      if (options && options.content) {
        this.editor.setValue(options.content);
        this.editor.clearSelection();
      }
    }

    resize() {
      this.editor.resize();
    }

    destroy() {
      super.destroy();
      offEditorOptionChange(this.$onEdChangeOptions);
      this.editor.destroy();
    }
  }
}

export = EditorView;
