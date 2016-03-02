import BoxLayout = require('./BoxLayout');
import EditorView = require('./EditorView');
import Workspace = require('../client/Workspace');
import Session = require('../client/Session');
import core = require('../core');
import _ = require('underscore');

type Graph = Workspace.Graph;

var classes = {
  "compile": "fa-cube", //fa-puzzle-piece",
  "link": "fa-cubes", //fa-link",
  "copy": "fa-clone",
  "environment": "fa-globe",
  "target": "fa-dot-circle-o",
  "root": "fa-briefcase",
  "variant": "fa-cog",
  "plistinfo": "fa-info",
}
function getFAClass(type: string) {
  return classes[type] || "fa-question";
}
function createIcon(type: string) : HTMLElement {
  var icon = document.createElement('span');
  var cls = getFAClass(type);
  icon.className = "fa fa-fw " + cls;
  return icon;
}
class TaskTreeItem extends core.TreeItemView {
  $ondeepcountchange;
  graph: Graph;
  graphview: SessionGraphView;
  last: Node;

  constructor(graph: Graph, graphview: SessionGraphView) {
    super();
    this.graph = graph;
    this.graphview = graphview;
    this.nameContainer.className = "tree-item-task-name";
    this.nameContainer.appendChild(createIcon(graph.name.type));
    this.last = document.createTextNode((classes[graph.name.type] ? "" : graph.name.type + " ") + graph.name.name)
    this.nameContainer.appendChild(this.last);
    core.menu.bindContextMenuTo(this.nameContainer, () => {
      return [{
        label: "Run",
        click: () => { (new core.async.Async(null, (p) => { this.graphview.session.start(p, [graph.id]); })).continue(); }
      }];
    });
    if (graph.tasks && graph.tasks.length)
      this.setCanExpand(true);
    this.nameContainer.addEventListener('click', () => { this.graphview.setTask(this.graph); }, false);
    this.loadDiagnostics();
  }

  destroy() {
    super.destroy();
  }

  createChildItems(p) {
    this.graph.tasks.forEach((t) => {
      this.addChildItem(new TaskTreeItem(t, this.graphview));
    })
    p.continue();
  }

  loadDiagnostics() {
    while (this.nameContainer.lastChild !== this.last)
      this.nameContainer.removeChild(this.nameContainer.lastChild);
    var c: HTMLElement, el: HTMLElement;
    if (this.graph.deepWarnings + this.graph.deepErrors > 0) {
      c = document.createElement('span');
      c.className = "badge-right";
      if (this.graph.deepWarnings > 0) {
        el = document.createElement('span');
        el.className = "badge-warning";
        el.textContent = this.graph.deepWarnings.toString();
        c.appendChild(el);
      }
      if (this.graph.deepErrors > 0) {
        var el = document.createElement('span');
        el.className = "badge-error";
        el.textContent = this.graph.deepErrors.toString();
        c.appendChild(el);
      }
      this.nameContainer.appendChild(c);
    }
  }
}

function parse(g: Graph, into: any[]) {
  var run = (<any>g).RUN;
  if (run) {
    var o = Workspace.parseLogs(run.logs);
    if (o)
      into.push.apply(into, o);
  }
  if (g.tasks) {
    for(var task of g.tasks) {
      parse(task, into);
    }
  }
}

class DiagnosticView extends core.View {
  constructor(diags: Workspace.Diagnostic[]) {
    super('div');
    this.el.className = "container-fluid";
    diags.forEach((d) => {
      this.el.appendChild(this.createHTMLDiagnostic(d, false));

    });
  }

  createHTMLDiagnostic(d: Workspace.Diagnostic, note: boolean) : HTMLElement {
    var container = document.createElement('div');
    container.className = "diagnostic diagnostic-" + d.type;
    $('<div>' + _.escape(d.msg) + '</div>').appendTo(container);
    $('<div>Line: ' + d.row + ', column: ' + d.col + '</div>').appendTo(container);
    $('<div>Path: ' + _.escape(d.path) + '</div>').appendTo(container);
    if (!note && d.notes.length) {
      d.notes.forEach((n) => {
        container.appendChild(this.createHTMLDiagnostic(n, true));
      });
    }
    return container;
  }
}

class WorkspaceTaskView extends core.View {
  info: HTMLElement;
  tabs: core.TabLayout;
  layout: BoxLayout;

  constructor() {
    super();
    var row: HTMLElement;

    this.info = document.createElement('div');
    this.info.className = "container-fluid";
    this.tabs = new core.TabLayout();
    this.layout = new BoxLayout({ orientation: BoxLayout.Orientation.VERTICAL, userCanResize: false });
    this.layout.appendView(new core.View(this.info), 1);
    this.layout.appendView(this.tabs, 0.75);
    this.layout.appendTo(this.el);
  }

  setTask(t: Workspace.TaskInfo, g: Graph) {
    this.tabs.clear(true);
    var html = '';
    html += '<div class="row">';
    html +=   '<div class="col-xs-6">Name: <span class="fa fa-fw ' + getFAClass(t.name.type) + '"></span>' + _.escape(t.name.name) + '</div>';
    html +=   '<div class="col-xs-6">Type: ' + _.escape(t.name.type) + '</div>';
    html += '</div>';

    var d = t.data;
    if (!d) d= <any>{};
    if (d.SHARED && d.SHARED.command && d.SHARED.command.args)
      this.tabs.appendView(new core.ContentView.Simple("Arguments", new EditorView.SimpleEditorView({ content: d.SHARED.command.args.join('\n') })));
    if (d.SHARED && d.SHARED.headers)
      this.tabs.appendView(new core.ContentView.Simple("Headers", new EditorView.SimpleEditorView({ content: d.SHARED.headers.join('\n') })));
    if (g.diagnostics.length)
      this.tabs.appendView(new core.ContentView.Simple("Diagnostics", new DiagnosticView(g.diagnostics)));

    var appendDetails = (title: string, i: Workspace.ActionInfo) => {
      html += '<div class="row">';
      html +=   '<div class="col-xs-12">';
      if (i && i.lastRunStartTime > 0) {
        html += title + ' was run with ';
        html += (i.errors === 0 ? '<span class="text-success">success</span>' : '<span class="text-danger">errors</span>');
        html += ' the ' + (new Date(i.lastRunEndTime)).toLocaleString();
        if (i.logs && i.logs.length > 0)
          this.tabs.appendView(new core.ContentView.Simple(title + " logs", new EditorView.SimpleEditorView({ content: i.logs })));
      }
      else {
        html += title + ' hasn\'t been run yet';
      }
      html +=   '</div>';
      html += '</div>';
    }
    for (var k in d) {
      if (k !== 'SHARED') {
        appendDetails(k[0].toUpperCase() + k.substring(1), d[k]);
      }
    }
    $(this.info).html(html);
  }
}

class WorkspaceDepsTreeItem extends core.TreeItemView {
  constructor(public workspace: Workspace, public graphview: SessionGraphView) {
    super(workspace.path);
    var icon = document.createElement('span');
    icon.className = "fa fa-fw fa-external-link";
    this.nameContainer.appendChild(icon);
    this.nameContainer.appendChild(document.createTextNode('dependencies'));
    this.setCanExpand(true);
  }

  createChildItems(p) {
    this.workspace.dependencies.forEach((w) => {
      this.addChildItem(new WorkspaceTreeItem(w.workspace, this.graphview));
    });
    p.continue();
  }
}

class WorkspaceEnvTreeItem extends core.TreeItemView {
  constructor(env: string, public targets: Graph[], public root: WorkspaceTreeItem) {
    super(env);
    var icon = document.createElement('span');
    icon.className = "fa fa-fw fa-globe";
    this.nameContainer.appendChild(icon);
    this.nameContainer.appendChild(document.createTextNode(env));
    this.setCanExpand(true);
  }

  createChildItems(p) {
    this.targets.forEach((target) => {
      var item = new TaskTreeItem(target, this.root.graphview);
      this.root.targets[target.id] = item
      this.addChildItem(item);
    });
    p.continue();
  }

  collapse() {
    this.targets.forEach((target) => {
      delete this.root.targets[target.id];
    });
    super.collapse();
  }
}

class WorkspaceVariantTreeItem extends core.TreeItemView {
  constructor(variant: string, public envs: { [s:string]: Graph[] }, public root: WorkspaceTreeItem) {
    super(variant);
    var icon = document.createElement('span');
    icon.className = "fa fa-fw fa-cog";
    this.nameContainer.appendChild(icon);
    this.nameContainer.appendChild(document.createTextNode(variant));
    this.setCanExpand(true);
  }

  createChildItems(p) {
    for(var env in this.envs) {
      this.addChildItem(new WorkspaceEnvTreeItem(env, this.envs[env], this.root));
    }
    p.continue();
  }
}


class WorkspaceTreeItem extends core.TreeItemView {
  $ondiagnostic; targets: { [s:string]: TaskTreeItem };

  constructor(public workspace: Workspace, public graphview: SessionGraphView) {
    super(workspace.path);
    var icon = document.createElement('span');
    icon.className = "fa fa-fw fa-briefcase";
    this.targets = {};
    this.nameContainer.appendChild(icon);
    this.nameContainer.appendChild(document.createTextNode(this.workspace.name));
    this.nameContainer.setAttribute('title', this.workspace.path);
    this.removeChildItems();
    this.setCanExpand(true);
    core.globals.ide.session.diagnostics.on("diagnostic", this.$ondiagnostic = this.ondiagnostic.bind(this));
  }

  destroy() {
    core.globals.ide.session.diagnostics.off("diagnostic", this.$ondiagnostic);
    super.destroy();
  }

  ondiagnostic(e) {
    var task = e.diag.task;
    if (!task) return;
    var recurse = (task) => {
      var parent: any = task.name !== "target" ? recurse(task.parent) : this.targets[task.id];
      var found = parent ? parent.childs.find((c) => { return c.graph === task }) : null;
      if (found)
        found.loadDiagnostics();
      return found;
    };
    recurse(task);
  }

  createChildItems(p) {
    if (this.workspace.dependencies.length) {
      this.addChildItem(new WorkspaceDepsTreeItem(this.workspace, this.graphview));
    }
    var variants = this.graphview.workspaces[this.workspace.path];
    for(var variant in variants) {
      this.addChildItem(new WorkspaceVariantTreeItem(variant, variants[variant], this));
    }
    p.continue();
  }
}


class SessionGraphView extends core.ContentView {
  $onreload;
  session: Session;
  workspaces: { [s: string]: { [s: string]: { [s: string]: Graph[] }}}
  layout: BoxLayout;
  taskview: WorkspaceTaskView;
  tree: WorkspaceTreeItem;

  constructor(data) {
    super();
    this.session = core.globals.ide.session;
    this.titleEl.textContent = "Build graph";
    this.workspaces = null;
    this.taskview = new WorkspaceTaskView();
    this.layout = new BoxLayout({userCanResize:true, orientation: BoxLayout.Orientation.HORIZONTAL});
    this.layout.appendTo(this.el);
    this.layout.appendView(this.taskview, 1.0);
    this.session.on('reload-workspace', this.$onreload = this.reload.bind(this));
    this.reload(data);
  }

  destroy() {
    this.session.off('reload-workspace', this.$onreload);
    super.destroy();
  }

  reload(data?) {
    core.async.run(null, [
      (p) => {
        data = data || this.data();
        p.continue();
      },
      this.session.graph.bind(this.session),
      (p) => {
        this.setGraph(p.context.result, data);
        p.continue();
      }
    ]);
  }

  setGraph(g: Graph, data) {
    var n: WorkspaceTreeItem;
    var old = this.workspaces;
    var workspaces: any = {};
    if (g.tasks && g.tasks.length) {
      g.tasks.forEach((target) => {
        var n: any = target.name;
        if (n.type !== "target" || !n.environment || !n.workspace || !n.variant) return;
        var w = workspaces[n.workspace];
        if (!w) w= workspaces[n.workspace]= {};
        var v = w[n.variant];
        if (!v) v= w[n.variant]= {};
        var e = v[n.environment];
        if (!e) e= v[n.environment] = [];
        e.push(target);
      })
    }
    this.workspaces = workspaces;
    if (!old)
      this.layout.insertView(n= new WorkspaceTreeItem(this.session.workspace, this), 0.25, 0);
    else if (this.workspaces)
      this.layout.replaceViewAt(0, n= new WorkspaceTreeItem(this.session.workspace, this)).destroy();
    else
      this.layout.removePart(0, true);
    this.tree = n;
    if (n) n.setExpandData(data && data.tree);
  }

  setTask(t: Graph) {
    (new core.async.Async(null, [
      (p) => { this.session.taskInfo(p, t.id); },
      (p) => { this.taskview.setTask(p.context.result, t); p.continue(); }
    ])).continue();
  }

  isViewFor(session) {
    return this.session === session;
  }

  data() {
    return { tree: this.tree && this.tree.expandData() };
  }
}

core.ContentView.register(SessionGraphView, "sessiongraphview");

export = SessionGraphView;
