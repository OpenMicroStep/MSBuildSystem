import {globals, View, ContentView, TreeItemView, DockLayout, async, menu, util} from '../core';
import Workspace = require('../client/Workspace');
import diagnostics = require('../client/diagnostics');
import WorkspaceSettingsView = require('./WorkspaceSettingsView');
import EditorView = require('./EditorView');
import DiagnosticsView = require('./DiagnosticsView');

class DiagTreeItemView extends TreeItemView {
  diags: HTMLElement;
  constructor(public node: diagnostics.FileTree, id) {
    super(id);
    this.diags = null;
    this.loadDiagnostics();
  }

  _createBadge(type: string, nb: number) {
    var el = document.createElement('span');
    el.className = "badge-" + type;
    el.textContent = nb.toString();
    return el;
  }

  loadDiagnostics() {
    var c: HTMLElement, el: HTMLElement;
    if (this.diags) {
      this.nameContainer.removeChild(this.diags);
      this.diags = null;
    }
    var d = this.node;
    if (d.warnings > 0 || d.errors > 0) {
      c = document.createElement('span');
      c.className = "badge-right";
      if (d.warnings > 0)
        c.appendChild(this._createBadge("warning", d.warnings));
      if (d.errors > 0)
        c.appendChild(this._createBadge("error", d.errors));
      this.nameContainer.appendChild(c);
      this.diags = c;
    }
  }
}

class WorkspaceDepsTreeItem extends DiagTreeItemView {
  constructor(node) {
    super(node, 'dependencies');
    var icon = document.createElement('span');
    icon.className = "fa fa-fw fa-external-link";
    this.nameContainer.appendChild(icon);
    this.nameContainer.appendChild(document.createTextNode('dependencies'));
    this.setCanExpand(true);
  }

  createChildItems(p) {
    this.node.childs.forEach((node) => {
      this.addChildItem(new WorkspaceTreeItem(node));
    });
    p.continue();
  }
}

class WorkspaceTreeItem extends DiagTreeItemView {
   name: Text;

  constructor(node) {
    super(node, node.infos.path);
    var icon = document.createElement('span');
    icon.className = "fa fa-fw fa-briefcase";
    this.nameContainer.appendChild(icon);
    this.nameContainer.appendChild(this.name = document.createTextNode(node.infos.name));
    this.nameContainer.setAttribute('title', node.infos.path);
    this.nameContainer.addEventListener("click", () => {
       //globals.ide.openSettings(this.workspace);
    });
    this.setCanExpand(true);
    this.removeChildItems();
  }

  createChildItems(p) {
    var childs = this.node.childs;
    var len = childs.length;
    var i = 0;
    if (i < len && childs[0].infos === "dependencies")
      this.addChildItem(new WorkspaceDepsTreeItem(childs[i++]));
    while (i < len) {
      this.addChildItem(new FileTreeItem(childs[i++], this));
    }
    var file = null;
    this.addChildItem(new FileTreeItem({ warnings: 0, errors: 0, parents: [], infos: {file:"make.js"}, childs: [] }, this));
    p.continue();
  }
}

class FileTreeItem extends DiagTreeItemView {
  root: WorkspaceTreeItem;
  constructor(node, root: WorkspaceTreeItem) {
    var d = node.infos;
    super(node, d.file || d.group);
    this.root = root;
    var icon = document.createElement('span');
    var text, tooltip;
    if (d.file) {
      tooltip = d.file;
      var p = util.splitPath(d.file);
      text = p.name + "." + p.extension;
      icon.className = "fa fa-fw fa-file-ico fa-file-ico-" + p.extension;
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
  }

  loadDiagnostics() {
    super.loadDiagnostics();
    var data = this.expandData();
    this.collapse();
    var diags = this.node.warnings > 0 || this.node.errors > 0;
    this.setCanExpand(diags);
    if (diags)
      this.setExpandData(data);
  }

  open() : async.Async {
    return async.run(null, (p) => { globals.ide.openFile(p, { path: this.root.node.infos.filePath(this.node.infos.file) }); });
  }

  createChildItems(p) {
    if (this.node.infos.file) {
      var diags = globals.ide.session.diagnostics.byPath.get(this.root.node.infos.directory + "/" + this.node.infos.file);
      if (diags) {
        diags.forEach((diag) => {
          this.addChildItem(new DiagnosticsView.DiagTreeItem(diag));
        });
      }
    }
    else {
      for(var f of this.node.childs) {
        this.addChildItem(new FileTreeItem(f, this.root));
      }
    }
    p.continue();
  }
}

class WorkspaceTreeView extends ContentView {
  root: WorkspaceTreeItem; $reload; $ondiagnostic;
  constructor(data) {
    super();
    this.root = null;
    this.titleEl.appendChild(document.createTextNode("Files"));
    globals.ide.session.on('reload-workspace', this.$reload = this.reload.bind(this));
    globals.ide.session.diagnostics.on("diagnostic", this.$ondiagnostic = this.ondiagnostic.bind(this));
    this.reload(data || { expanded: true })

  }

  destroy() {
    globals.ide.session.off('reload-workspace', this.$reload);
    globals.ide.session.diagnostics.off("diagnostic", this.$ondiagnostic);
    this.root.destroy();
    super.destroy();
  }

  ondiagnostic(e) {
    var d = e.diag;
    var nodes = globals.ide.session.diagnostics.byTreeLeaf.get(d.path);
    var root = this.root.node;
    var recurse = (node: diagnostics.FileTree) => {
      var result: DiagTreeItemView = null;
      if (node === root) {
        result = this.root;
      }
      else {
        var parents = node.parents;
        for (var i = 0, len = parents.length; !result && i < len; ++i) {
          result = recurse(parents[i]);
        }
        if (result)
          result = <DiagTreeItemView>result.getChildViews().find((v: DiagTreeItemView) => { return v.node === node; });
      }
      if (result)
        result.loadDiagnostics();
      return result;
    };
    nodes.forEach(recurse);
  }

  reload(data) {
    var data = data || this.root.expandData();
    if (this.root)
      this.root.destroy();
    this.root = new WorkspaceTreeItem(globals.ide.session.diagnostics.tree);
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
