import core = require('../core');
import Workspace = require('../client/Workspace');
import EditorView = require('./EditorView');
import ContentView = require('./ContentView');

type Types = { [s:string]: ((srcpath: string) => ((counterpartpath: string) => number)) };

var splitPath = core.util.splitPath;
function searchInFiles(srcpath: string, w, files: any[], matcher: (counterpartpath) => number, results: any[]) {
  for (var i = 0, len = files.length; i < len; ++i) {
    var file = files[i];
    if (file.file) {
      var path = w.filePath(file.file);
      var dist = matcher(path);
      if (dist < Number.MAX_SAFE_INTEGER)
        results.push({ dist: dist, path: path });
    }
    if (file.files) {
      searchInFiles(srcpath, w, file.files, matcher, results);
    }
  }
}
function sortSearchResult(a, b) {
  return a.dist - b.dist;
}

var counterpartwithexts = function(srcpath, exts) {
  var i, s = splitPath(srcpath);
  s.name = s.name.toLowerCase().replace(/\.[^.]+$/, '');
  s.directory = s.directory.toLowerCase();
  return function(counterpartpath) {
    var c = splitPath(counterpartpath);
    if (exts.indexOf(c.extension) !== -1 && c.name.toLowerCase().replace(/\.[^.]+$/, '') === s.name)
      return s.directory === c.directory.toLowerCase() ? 0 : 1;
    return Number.MAX_SAFE_INTEGER;
  }
}

var nocounterpart = function () {
  return Number.MAX_SAFE_INTEGER;
}

class CounterpartsView extends core.ContentView {
  static types = {
    srcorheader: {
      title: function(titleEl) { $('<i class="fa fa-fw fa-share"></i>').appendTo(titleEl); },
      matcher: function (srcpath) {
        if (/\.(c|cpp|m|mm)$/.test(srcpath))
          return CounterpartsView.types.header.matcher(srcpath);
        else
          return CounterpartsView.types.src.matcher(srcpath);
      }
    },
    src: {
      title: function(titleEl) { $('<i class="fa fa-fw fa-file-code-o"></i>').appendTo(titleEl); },
      matcher: function (srcpath) { return counterpartwithexts(srcpath, ['c', 'cpp', 'm', 'mm']); }
    },
    header: {
      title: function(titleEl) { $('<i class="fa fa-fw fa-file-text-o"></i>').appendTo(titleEl); },
      matcher: function (srcpath) { return counterpartwithexts(srcpath, ['h', 'hpp']); }
    },
    doc: {
      title: function(titleEl) { $('<i class="fa fa-fw fa-book"></i>').appendTo(titleEl); },
      matcher: function (srcpath) { return counterpartwithexts(srcpath, ['md']); }
    },
  };
  type: string;
  results: { dist: number, path: string };
  $currentViewChange;
  editor: EditorView;
  counterpartEl: HTMLElement;

  constructor(options? : { type: string, path?: string }) {
    super();
    this.titleEl.className = "title-counterpart";
    this.counterpartEl = document.createElement("div");
    this.titleEl.appendChild(this.counterpartEl);
    core.globals.ide.on("currentViewChange", this.$currentViewChange = this.currentViewChange.bind(this));
    this.setCounterpart(options && options.path);
    this.setType((options && options.type) || "srcorheader", !(options && options.path));
  }

  focus() {
    super.focus();
  }

  destroy() {
    core.globals.ide.off("currentViewChange", this.$currentViewChange);
    if (this.editor)
      this.editor.destroy();
    super.destroy();
  }

  resize() {
    if (this.editor)
      this.editor.resize();
    super.resize();
  }

  isViewFor(data) {
    return data && data.type === this.type;
  }

  setType(type: string, refresh) {
    if (this.type === type)
      return;
    this.type = type;
    $(this.counterpartEl).empty();
    CounterpartsView.types[this.type].title(this.counterpartEl);
    if (refresh)
      this.currentViewChange();
  }

  data() {
    return { type: this.type, path: this.editor && this.editor.path };
  }

  setCounterpart(path: string) {
    if (this.editor && this.editor.path === path)
      return;
    if (this.editor) {
      this.editor.destroy();
      this.editor = null;
    }
    if (path) {
      this.editor = new EditorView({ path: path });
      this.editor.appendTo(this.el);
      this.editor.appendTitleTo(this.titleEl);
    }
  }

  currentViewChange() {
    var results = [];
    var view: EditorView = <EditorView>core.globals.ide.currentView();
    if (!(view instanceof EditorView) || view === this.editor) return;
    // console.log("search " + this.type + " counterpart for " + view.path);
    var matcher = CounterpartsView.types[this.type].matcher(view.path);
    Workspace.workspaces.forEach((w) => {
      searchInFiles(view.path, w, w.files, matcher, results);
      searchInFiles(view.path, w, [{ file: 'make.js' }], matcher, results);
    });
    results = results.sort(sortSearchResult);
    if (results.length) {
      this.setCounterpart(results[0].path);
      //console.log("will display", results[0]);
    }
  }

  extendsContextMenu(items, tabLayout, idx) {
    var data = this.editor && this.editor.data();
    if (data) {
      items.push(
        { type: "separator"},
        {
          label: "Open counterpart in new tab",
          click: () => {
            tabLayout.insertView(new EditorView(data), idx + 1, false);
          }
        }
      );
    }
    items.push(
      { type: "separator"},
      { label: "Source or header" , click: () => { this.setType("srcorheader", true); } },
      { label: "Documentation"    , click: () => { this.setType("doc"        , true); } },
      { label: "Source"           , click: () => { this.setType("src"        , true); } },
      { label: "Header"           , click: () => { this.setType("header"     , true); } }
    );
  }

}

core.ContentView.register(CounterpartsView, "counterpart");
export = CounterpartsView;
