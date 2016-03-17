import BoxLayout = require('./BoxLayout');
import EditorView = require('./EditorView');
import Workspace = require('../client/Workspace');
import Session = require('../client/Session');
import diagnostics = require('../client/diagnostics');
import core = require('../core');
import _ = require('underscore');

type Graph = Workspace.Graph;

interface GraphNode {
  warnings: number;
  errors: number;
}
interface EnvNode extends GraphNode {
  targets: Graph[];
}
interface VariantNode extends GraphNode {
  environments: Map<string, EnvNode>;
}
interface WorkspaceNode extends GraphNode {
  variants: Map<string, VariantNode>;
}

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

class TaskTreeItem extends diagnostics.DiagCounterTreeItem {
  $ondeepcountchange;
  graph: Graph;
  graphview: SessionGraphView;
  last: Node;

  constructor(graph: Graph, graphview: SessionGraphView) {
    super(JSON.stringify(graph.name));
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

  ondiagnostic(target, ev) {
    this.loadDiagnostics();
  }

  getDiagnosticsCount() {
    return { warnings: this.graph.deepWarnings, errors: this.graph.deepErrors };
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

class GraphNodeTreeItem extends diagnostics.DiagCounterTreeItem {

  constructor(id: string, public node: GraphNode) {
    super(id);
    this.loadDiagnostics();
  }

  getDiagnosticsCount() { return this.node; }

  ondiagnostic(target, ev) {
    this.loadDiagnostics();
    return null;
  }
}

class WorkspaceDepsTreeItem extends GraphNodeTreeItem {
  constructor(public workspace: Workspace, public graphview: SessionGraphView) {
    super(workspace.path, { warnings: 0, errors: 0 });
    var icon = document.createElement('span');
    icon.className = "fa fa-fw fa-external-link";
    this.nameContainer.appendChild(icon);
    this.nameContainer.appendChild(document.createTextNode('dependencies'));
    this.setCanExpand(true);
  }

  ondiagnostic(target: Graph, ev) {
    var w = <WorkspaceTreeItem>this.childs.find((w : WorkspaceTreeItem) => { return w.workspace.path === target.name.workspace; });
    var r = w && w.ondiagnostic(target, ev);
    this.loadDiagnostics();
    return r;
  }

  loadDiagnostics() {
    var warnings= 0, errors= 0;
    this.childs.forEach((w : WorkspaceTreeItem) => {
      warnings += w.node.warnings;
      errors += w.node.errors;
    });
    this.node.warnings = warnings;
    this.node.errors = errors;
    super.loadDiagnostics();
  }

  createChildItems(p) {
    this.workspace.dependencies.forEach((w) => {
      if (this.graphview.workspaces.has(w.workspace.path))
        this.addChildItem(new WorkspaceTreeItem(w.workspace, this.graphview));
    });
    p.continue();
  }
}

class WorkspaceEnvTreeItem extends GraphNodeTreeItem {
  node: EnvNode;

  constructor(public env: string, node: EnvNode, public root: WorkspaceTreeItem) {
    super(env, node);
    var icon = document.createElement('span');
    icon.className = "fa fa-fw fa-globe";
    this.nameContainer.appendChild(icon);
    this.nameContainer.appendChild(document.createTextNode(env));
    this.setCanExpand(true);
  }

  createChildItems(p) {
    this.node.targets.forEach((target) => {
      var item = new TaskTreeItem(target, this.root.graphview);
      this.addChildItem(item);
    });
    p.continue();
  }

  ondiagnostic(target: Graph, ev) {
    super.ondiagnostic(target, ev);
    return this.childs.find((t) => { return (<any>t).graph === target; });
  }

  collapse() {
    super.collapse();
  }
}


class WorkspaceVariantTreeItem extends GraphNodeTreeItem {
  node: VariantNode;

  constructor(public variant: string, node: VariantNode, public root: WorkspaceTreeItem) {
    super(variant, node);
    var icon = document.createElement('span');
    icon.className = "fa fa-fw fa-cog";
    this.nameContainer.appendChild(icon);
    this.nameContainer.appendChild(document.createTextNode(variant));
    this.setCanExpand(true);
  }

  ondiagnostic(target: Graph, ev) {
    super.ondiagnostic(target, ev);
    var e: any = this.childs.find((e: WorkspaceEnvTreeItem) => { return e.env === target.name.environment; });
    return e && e.ondiagnostic(target, ev);
  }

  createChildItems(p) {
    this.node.environments.forEach((node, name) => {
      this.addChildItem(new WorkspaceEnvTreeItem(name, node, this.root));

    });
    p.continue();
  }
}


class WorkspaceTreeItem extends GraphNodeTreeItem {
  node: WorkspaceNode;

  constructor(public workspace: Workspace, public graphview: SessionGraphView) {
    super(workspace.path, graphview.workspaces.get(workspace.path));
    var icon = document.createElement('span');
    icon.className = "fa fa-fw fa-briefcase";
    this.nameContainer.appendChild(icon);
    this.nameContainer.appendChild(document.createTextNode(this.workspace.name));
    this.nameContainer.setAttribute('title', this.workspace.path);
    this.removeChildItems();
    this.setCanExpand(true);
  }

  ondiagnostic(target: Graph, ev) {
    super.ondiagnostic(target, ev);
    if (target.name.workspace === this.workspace.path) {
      var v: any = this.childs.find((v: WorkspaceVariantTreeItem) => { return v.variant === target.name.variant; });
      return v && v.ondiagnostic(target, ev);
    }
    else if (this.childs[0] instanceof WorkspaceDepsTreeItem)
      return (<any>this.childs[0]).ondiagnostic(target, ev);
    return null;
  }

  createChildItems(p) {
    if (this.workspace.dependencies.length && this.graphview.workspaces.size > 1) {
      this.addChildItem(new WorkspaceDepsTreeItem(this.workspace, this.graphview));
    }
    if (this.node) {
      this.node.variants.forEach((node, name) => {
        this.addChildItem(new WorkspaceVariantTreeItem(name, node, this));
      });
    }
    p.continue();
  }
}

class SessionGraphView extends core.ContentView {
  $onreload; $ondiagnostic;
  session: Session;
  workspaces: Map<string, WorkspaceNode>;
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
    core.globals.ide.session.diagnostics.on("diagnostic-task", this.$ondiagnostic = this.ondiagnostic.bind(this));
    this.reload(data);
  }

  destroy() {
    this.session.off('reload-workspace', this.$onreload);
    core.globals.ide.session.diagnostics.off("diagnostic-task", this.$ondiagnostic);
    super.destroy();
  }

  ondiagnostic(ev) {
    var recurse = (task) => {
      if (!task) return null;
      var isTarget = task.name.type === "target";
      if (isTarget) {
        var diff = ev.action === "add" ? +1 : -1;
        var warnings = 0;
        var errors = 0;
        if (ev.diag.type === "warning")
          warnings += diff;
        else if (ev.diag.type === "error")
          errors += diff;
        var n = task.name;
        var w = this.workspaces.get(n.workspace);
        var v = w && w.variants.get(n.variant);
        var e = v && v.environments.get(n.environment);
        [w, v, e].forEach((n) => {
          if (!n) return;
          n.warnings += warnings;
          n.errors += errors;
        });
      }
      var parent = isTarget ? this.tree.ondiagnostic(task, ev) : recurse(task.parent);
      return isTarget ? parent : parent && parent.ondiagnostic(task, ev);
    };
    recurse(ev.task);
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
    var targets = [];
    var workspaces = new Map<string, WorkspaceNode>();
    if (g.tasks && g.tasks.length) {
      g.tasks.forEach((target) => {
        var n: any = target.name;
        if (n.type !== "target" || !n.environment || !n.workspace || !n.variant) return;
        var w = workspaces.get(n.workspace);
        if (!w) workspaces.set(n.workspace, w= { warnings: 0, errors: 0, variants: new Map<string, VariantNode>() });
        var v = w.variants.get(n.variant);
        if (!v) w.variants.set(n.variant, v= { warnings: 0, errors: 0, environments: new Map<string, EnvNode>() });
        var e = v.environments.get(n.environment);
        if (!e) v.environments.set(n.environment, e= { warnings: 0, errors: 0, targets: [] });
        e.targets.push(target);
        [w, v, e].forEach((n) => {
          if (!n) return;
          n.warnings += target.deepWarnings;
          n.errors += target.deepErrors;
        });
      });
    }
    this.workspaces = workspaces;
    if (!old)
      this.layout.insertView(n= new WorkspaceTreeItem(this.session.workspace, this), 0.25, 0);
    else
      this.layout.replaceViewAt(0, n= new WorkspaceTreeItem(this.session.workspace, this)).destroy();
    this.tree = n;
    targets.forEach((t) => {
      t.diagnostics.forEach((d) => { this.ondiagnostic({ diag: d, task: t, action: "add" }); });
    });
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
