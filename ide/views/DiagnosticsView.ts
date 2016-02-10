import {globals, View, ContentView, TreeItemView, async, menu, util} from '../core';
import Workspace = require('../client/Workspace');
import diagnostics = require('../client/diagnostics');
import EditorView = require('./EditorView');

class FixitTreeItem extends TreeItemView {
  applied: boolean;
  constructor(public fixit: diagnostics.Fixit) {
    super();
    this.applied = false;
    var icon = document.createElement('span');
    icon.className = "fa fa-fw fa-wrench";
    this.nameContainer.appendChild(icon);
    this.nameContainer.appendChild(document.createTextNode("fixit: replace with " + fixit.replacement));
    this.nameContainer.addEventListener("click", this.open.bind(this, false));
    menu.bindContextMenuTo(this.nameContainer, () => {
      return this.applied ? null : [{
        label: "Apply",
        click: this.open.bind(this, true)
      }]
    })
  }

  open(apply?: boolean) {
    async.run(null, [
      (p) => { globals.ide.openFile(p, {path: this.fixit.path }); },
      (p) => {
        var ed: AceAjax.Editor = p.context.view && p.context.view.editor;
        if (ed) { setTimeout(() => {
          var r = this.fixit.range;
          var s = ed.getSelection();
          var edrange = new EditorView.Range(r.srow - 1, r.scol - 1, r.erow - 1, r.ecol - 1);
          s.setSelectionRange(edrange);
          ed.scrollToLine(r.srow - 1, true, true, void 0);
          if (apply && !this.applied) {
            ed.getSession().replace(edrange, this.fixit.replacement);
            this.applied = true;
          }
        }, 0);}
      }
    ]);
  }
}

class DiagTreeItem extends TreeItemView {
  constructor(public diag: Workspace.Diagnostic) {
    super();
    var icon = document.createElement('span');
    icon.className = "badge-" + diag.type;
    this.nameContainer.appendChild(icon);
    this.nameContainer.appendChild(document.createTextNode(diag.msg));
    this.nameContainer.addEventListener("click", this.open.bind(this));
    if (diag.tasks) {
      var tooltip = "";
      diag.tasks.forEach((task) => {
        var target = task.target();
        if (!target) return;
        tooltip += target.name.variant + " " + target.name.environment + " " + target.name.name + "\n";
      });
      this.nameContainer.setAttribute('title', tooltip);
    }
    this.setCanExpand(this.diag.notes.length > 0 || this.diag.fixits.length > 0);
  }

  open() {
    async.run(null, (p) => { globals.ide.openFile(p, { path: this.diag.path, row: this.diag.row - 1, col: this.diag.col - 1 }); });;
  }

  createChildItems(p) {
    this.diag.notes.forEach((note) => {
      this.addChildItem(new DiagTreeItem(note));
    });
    this.diag.fixits.forEach((fixit) => {
      this.addChildItem(new FixitTreeItem(fixit));
    });
    p.continue();
  }
}

class DiagnosticsInFileTreeItem extends TreeItemView {
  constructor(public path: string, public diagnostics: diagnostics.Diagnostic[]) {
    super();
    this.nameContainer.appendChild(document.createTextNode(util.pathBasename(path)));
    this.setCanExpand(true);
  }

  createChildItems(p) {
    this.diagnostics.forEach((d) => {
      this.addChildItem(new DiagTreeItem(d));
    });
    p.continue();
  }
}

class DiagnosticsByPathTreeItem extends TreeItemView {
  constructor() {
    super();
    this.nameContainer.appendChild(document.createTextNode('By file path'));
    this.setCanExpand(true);
  }

  createChildItems(p) {
    globals.ide.session.diagnostics.byPath.forEach((diagnostics, path) => {
      this.addChildItem(new DiagnosticsInFileTreeItem(path, diagnostics));
    });
    p.continue();
  }
}

class DiagnosticsInTypeTreeItem extends TreeItemView {
  constructor(public name: string, public diagnostics: diagnostics.Diagnostic[]) {
    super();
    this.nameContainer.appendChild(document.createTextNode(name));
    this.setCanExpand(true);
  }

  createChildItems(p) {
    this.diagnostics.forEach((d) => {
      this.addChildItem(new DiagTreeItem(d));
    });
    p.continue();
  }
}

class DiagnosticsByTypeTreeItem extends TreeItemView {
  constructor() {
    super();
    this.nameContainer.appendChild(document.createTextNode('By type'));
    this.setCanExpand(true);
  }

  createChildItems(p) {
    var types = new Map<string, diagnostics.Diagnostic[]>();
    globals.ide.session.diagnostics.byPath.forEach((diagnostics, path) => {
      diagnostics.forEach((d) => {
        var cat = d.category || "Undefined";
        var type = types.get(cat);
        if (!type)
          types.set(cat, type= []);
        type.push(d);
      });
    });
    types.forEach((list, name) => {
      this.addChildItem(new DiagnosticsInTypeTreeItem(name, list));
    })
    p.continue();
  }
}

class DiagnosticsView extends ContentView {
  static FixitTreeItem = FixitTreeItem;
  static DiagTreeItem = DiagTreeItem;
  bypath: DiagnosticsByPathTreeItem;
  bytype: DiagnosticsByTypeTreeItem;
  constructor() {
    super();
    this.bypath = new DiagnosticsByPathTreeItem();
    this.bytype = new DiagnosticsByTypeTreeItem();
    this.titleEl.appendChild(document.createTextNode("Diagnostics"));
    this.bypath.appendTo(this.el);
    this.bytype.appendTo(this.el);
  }

  getChildViews() {
    return [this.bypath, this.bytype];
  }
  data() {
    return null;
  }
}
ContentView.register(DiagnosticsView, "diagnostics");


export = DiagnosticsView;
