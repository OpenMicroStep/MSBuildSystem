import {globals, View, ContentView, TreeItemView, DockLayout, async, menu} from '../core';
import Workspace = require('../client/Workspace');
import diagnostics = require('../client/diagnostics');
import WorkspaceSettingsView = require('./WorkspaceSettingsView');
import EditorView = require('./EditorView');

class WorkspaceDepsTreeItem extends TreeItemView {
  constructor(public workspace: Workspace) {
    super();
    var icon = document.createElement('span');
    icon.className = "glyphicon glyphicon-flash";
    this.nameContainer.appendChild(icon);
    this.nameContainer.appendChild(document.createTextNode('dependencies'));
    this.setCanExpand(true);
  }

  createChildItems(p) {
    this.workspace.dependencies.forEach((w) => {
      this.addChildItem(new WorkspaceTreeItem(w.workspace));
    });
    p.continue();
  }
}

class WorkspaceTreeItem extends TreeItemView {
  $ondiagnostic; $reload; name: Text;

  constructor(public workspace: Workspace) {
    super();
    var icon = document.createElement('span');
    icon.className = "fa fa-fw fa-briefcase";
    this.nameContainer.appendChild(icon);
    this.nameContainer.appendChild(this.name = document.createTextNode(this.workspace.name));
    this.nameContainer.setAttribute('title', this.workspace.path);
    this.nameContainer.addEventListener("click", () => {
       globals.ide.openSettings(this.workspace);
    });
    this.setCanExpand(true);
    this.removeChildItems();
    Workspace.diagnostics.on("diagnostic", this.$ondiagnostic = this.ondiagnostic.bind(this));
    this.workspace.on('reload', this.$reload = this.reload.bind(this));
  }

  reload() {
    this.name.data = this.workspace.name;
    if (this.state === TreeItemView.State.EXPANDED) {
      this.collapse();
      this.expand();
    }
  }

  destroy() {
    this.workspace.off('reload', this.$reload);
    Workspace.diagnostics.off("diagnostic", this.$ondiagnostic);
    super.destroy();
  }

  ondiagnostic(e) {
    var file = e.item;
    if (!file) return;
    var recurse = (file) => {
      var parent: any = file.diagnostics && file.diagnostics.parent ? recurse(file.diagnostics.parent) : this;
      var found = parent ? parent.childs.find((c) => { return c.d === file }) : null;
      if (found)
        found.loadDiagnostics();
      return found;
    };
    recurse(file);
  }

  createChildItems(p) {
    if (this.workspace.dependencies.length) {
      this.addChildItem(new WorkspaceDepsTreeItem(this.workspace));
    }
    for(var f of this.workspace.files) {
      this.addChildItem(new FileTreeItem(f, this));
    }
    var file = null;
    this.addChildItem(new FileTreeItem({file:"make.js"}, this));
    p.continue();
  }
}

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
      (p) => { globals.ide.openFile(p, this.fixit.path); },
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
    async.run(null, [
      (p) => { globals.ide.openFile(p, this.diag.path); },
      (p) => {
        var ed = p.context.view && p.context.view.editor;
        if (ed)
          setTimeout(() => { ed.gotoLine(this.diag.row, this.diag.col - 1, true); }, 0);
      }
    ]);
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

class FileTreeItem extends TreeItemView {
  diags: HTMLElement;
  constructor(public d, public root: WorkspaceTreeItem) {
    super();
    this.diags = null;
    var icon = document.createElement('span');
    var text, tooltip;
    if (d.file) {
      icon.className = "fa fa-fw fa-file";
      tooltip = d.file;
      text = d.file.replace(/^.+\//, '');
      this.nameContainer.addEventListener("click", this.open.bind(this));
    }
    else {
      icon.className = "fa fa-fw fa-folder";
      text = d.group;
      this.setCanExpand(true);
    }
    this.nameContainer.appendChild(icon);
    this.nameContainer.appendChild(document.createTextNode(" " + text));
    if (tooltip)
      this.nameContainer.setAttribute("title", tooltip);
    this.loadDiagnostics();
  }

  open() : async.Async {
    return async.run(null, (p) => { this.root.workspace.openFile(p, this.d.file); });
  }

  _createBadge(type: string, nb: number) {
    var el = document.createElement('span');
    el.className = "badge-" + type;
    el.textContent = nb.toString();
    return el;
  }
  loadDiagnostics() {
    var d;
    var c: HTMLElement, el: HTMLElement;
    if (this.diags) {
      this.nameContainer.removeChild(this.diags);
      this.diags = null;
    }
    if ((d = this.d.diagnostics) && (d.warnings > 0 || d.errors > 0)) {
      c = document.createElement('span');
      c.className = "badge-right";
      if (d.warnings > 0)
        c.appendChild(this._createBadge("warning", d.warnings));
      if (d.errors > 0)
        c.appendChild(this._createBadge("error", d.errors));
      this.nameContainer.appendChild(c);
      this.diags = c;
      if (this.d.file) {
        this.setCanExpand(true);
      }
    }
    else if (this.d.file) {
      this.setCanExpand(false);
    }
  }

  createChildItems(p) {
    if (this.d.file) {
      var diags: Workspace.Diagnostic[] = this.d.diagnostics.set;
      diags.forEach((diag) => {
        this.addChildItem(new DiagTreeItem(diag));
      });
    }
    else {
      for(var f of this.d.files) {
        this.addChildItem(new FileTreeItem(f, this.root));
      }
    }
    p.continue();
  }
}

class WorkspaceTreeView extends ContentView {
  root: WorkspaceTreeItem;
  constructor(workspace: Workspace) {
    super();
    this.root = new WorkspaceTreeItem(workspace);
    this.root.expand();
    this.root.appendTo(this.el);
    this.titleEl.appendChild(document.createTextNode("Workspace"));
  }

  getChildViews() {
    return [this.root];
  }
}

export = WorkspaceTreeView;
