import {globals, View, ContentView, TreeItemView, DockLayout, async, menu} from '../core';
import Workspace = require('../client/Workspace');
import diagnostics = require('../client/diagnostics');
import WorkspaceSettingsView = require('./WorkspaceSettingsView');
import EditorView = require('./EditorView');
import DiagnosticsView = require('./DiagnosticsView');

class WorkspaceDepsTreeItem extends TreeItemView {
  constructor(public workspace: Workspace) {
    super('dependencies');
    var icon = document.createElement('span');
    icon.className = "fa fa-fw fa-external-link";
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
    super(workspace.path);
    var icon = document.createElement('span');
    icon.className = "fa fa-fw fa-briefcase";
    this.nameContainer.appendChild(icon);
    this.nameContainer.appendChild(this.name = document.createTextNode(this.workspace.name));
    this.nameContainer.setAttribute('title', this.workspace.path);
    this.nameContainer.addEventListener("click", () => {
       //globals.ide.openSettings(this.workspace);
    });
    this.setCanExpand(true);
    this.removeChildItems();
    Workspace.diagnostics.on("diagnostic", this.$ondiagnostic = this.ondiagnostic.bind(this));
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

class FileTreeItem extends TreeItemView {
  diags: HTMLElement;
  constructor(public d, public root: WorkspaceTreeItem) {
    super(d.file || d.group);
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
    return async.run(null, (p) => { globals.ide.openFile(p, { path: this.root.workspace.filePath(this.d.file) }); });
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
        this.addChildItem(new DiagnosticsView.DiagTreeItem(diag));
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
  root: WorkspaceTreeItem; $reload;
  constructor(data) {
    super();
    this.root = null;
    this.titleEl.appendChild(document.createTextNode("Files"));
    globals.ide.session.on('reload-workspace', this.$reload = this.reload.bind(this));
    this.reload(data || { expanded: true })

  }

  destroy() {
    globals.ide.session.off('reload-workspace', this.$reload);
    this.root.destroy();
    super.destroy();
  }

  reload(data) {
    var data = data || this.root.expandData();
    if (this.root)
      this.root.destroy();
    this.root = new WorkspaceTreeItem(globals.ide.session.workspace);
    this.root.appendTo(this.el);
    this.root.setExpandData(data);
  }

  getChildViews() {
    return [this.root];
  }
  data() {
    return this.root.expandData();
  }
}
ContentView.register(WorkspaceTreeView, "treeview");

export = WorkspaceTreeView;
