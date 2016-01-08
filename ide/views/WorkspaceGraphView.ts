/// <reference path="../../typings/browser.d.ts" />

import BoxLayout = require('./BoxLayout');
import Workspace = require('../client/Workspace');
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
  graphview: WorkspaceGraphView;
  last: Node;

  constructor(graph: Graph, graphview: WorkspaceGraphView) {
    super();
    this.graph = graph;
    this.graphview = graphview;
    this.nameContainer.className = "tree-item-task-name";
    this.nameContainer.innerHTML = '';
    this.nameContainer.appendChild(createIcon(graph.name.type));
    this.last = document.createTextNode((classes[graph.name.type] ? "" : graph.name.type + " ") + graph.name.name)
    this.nameContainer.appendChild(this.last);
    core.menu.bindContextMenuTo(this.nameContainer, () => {
      return [{
        label: "Run",
        click: () => { (new core.async.Async(null, (p) => { this.graphview.workspace.start(p, [graph.id]); })).continue(); }
      }];
    });
    if (graph.tasks && graph.tasks.length)
      this.setCanExpand(true);
    this.nameContainer.addEventListener('click', () => { this.graphview.setTask(this.graph); }, false);
    this.graph.on('deepcountchange', this.$ondeepcountchange = this.ondeepcountchange.bind(this));
    this.ondeepcountchange();
  }

  destroy() {
    this.graph.off('deepcountchange', this.$ondeepcountchange);
    super.destroy();
  }

  createChildItems(p) {
    this.graph.tasks.forEach((t) => {
      this.addChildItem(new TaskTreeItem(t, this.graphview));
    })
    p.continue();
  }

  ondeepcountchange() {
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

class TextEditorView extends core.View {
  editor: AceAjax.Editor;

  constructor(text: string) {
    super('div');
    this.el.className = "fill";
    this.editor = ace.edit(this.el);
    this.editor.setReadOnly(true);
    this.editor.setValue(text);
    this.editor.clearSelection();
  }
  resize() {
    this.editor.resize();
    super.resize();
  }
}

class DiagnosticView extends core.View {
  constructor(diags: Workspace.Diagnostic[]) {
    super('div');

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
  layout: BoxLayout;

  constructor() {
    super();
    var row: HTMLElement;

    this.info = document.createElement('div');
    this.info.className = "container-fluid";
    this.layout = new BoxLayout({ orientation: BoxLayout.Orientation.VERTICAL, userCanResize: false });
    this.layout.appendView(new core.View(this.info), 1);
    this.layout.appendView(new core.View(document.createElement('div')), 0.75);
    this.layout.appendTo(this.el);
  }

  setTask(t: Workspace.TaskInfo, g: Graph) {
    var pills = [];
    var html = '';
    html += '<div class="row">';
    html +=   '<div class="col-xs-6">Name: <span class="fa fa-fw ' + getFAClass(t.name.type) + '"></span>' + _.escape(t.name.name) + '</div>';
    html +=   '<div class="col-xs-6">Type: ' + _.escape(t.name.type) + '</div>';
    html += '</div>';

    var d = t.data;
    if (!d) d= <any>{};
    if (d.SHARED && d.SHARED.command && d.SHARED.command.args)
      pills.push({ label: "Arguments", view: () => { return new TextEditorView(d.SHARED.command.args.join('\n')); }});
    if (d.SHARED && d.SHARED.headers)
      pills.push({ label: "Headers", view: () => { return new TextEditorView(d.SHARED.headers.join('\n')); }});
    if (g.diagnostics.length)
      pills.push({ label: "Diagnostics", view: () => { return new DiagnosticView(g.diagnostics); }});

    function appendDetails(title: string, i: Workspace.ActionInfo) {
      html += '<div class="row">';
      html +=   '<div class="col-xs-12">';
      if (i && i.lastRunStartTime > 0) {
        html += title + ' was run with ';
        html += (i.errors === 0 ? '<span class="text-success">success</span>' : '<span class="text-danger">errors</span>');
        html += ' the ' + (new Date(i.lastRunEndTime)).toLocaleString();
        if (i.logs && i.logs.length > 0)
          pills.push({ label: title + " logs", view: () => { return new TextEditorView(i.logs); }});
      }
      else {
        html += title + ' hasn\'t been run yet';
      }
      html +=   '</div>';
      html += '</div>';
    }
    appendDetails('Configure', d.CONFIGURE);
    appendDetails('Run', d.RUN);
    if (pills.length > 0) {
      html += '<div class="row">';
      html +=   '<div class="col-xs-12">';
      html +=     '<ul class="nav nav-pills"></ul>';
      html +=   '</div>';
      html += '</div>';
    }
    $(this.info).html(html);
    if (pills.length > 0) {
      var c = this.info.lastElementChild.firstElementChild.firstElementChild;
      pills.forEach((pill) => {
        var $li = $('<li role="presentation"><a href="#">'+ pill.label +'</a></li>');
        $li.on('click', () => {
          $li.parent().children().removeClass('active');
          $li.addClass('active');
          this.layout.replaceViewAt(1, pill.view()).destroy();
        })
        $li.appendTo(c);
      });
    }
    this.layout.replaceViewAt(1, new core.View(document.createElement('div'))).destroy();
  }
}

class WorkspaceGraphView extends core.ContentView {
  $onreload;
  workspace: Workspace;
  graph: Graph;
  layout: BoxLayout;
  taskview: WorkspaceTaskView;
  tree: TaskTreeItem;

  constructor(workspace: Workspace) {
    super();
    this.workspace = workspace;
    this.titleEl.textContent = "Build graph";
    this.graph = null;
    this.taskview = new WorkspaceTaskView();
    this.layout = new BoxLayout({userCanResize:true, orientation: BoxLayout.Orientation.HORIZONTAL});
    this.layout.appendTo(this.el);
    this.layout.appendView(this.taskview, 1.0);
    this.workspace.on('reload', this.$onreload = this.reload.bind(this));
    this.reload();
  }

  destroy() {
    this.workspace.off('reload', this.$onreload);
    super.destroy();
  }

  reload() {
    (new core.async.Async(null, [
      this.workspace.graph.bind(this.workspace),
      (p) => { this.setGraph(p.context.result); p.continue(); }
    ])).continue();
  }

  setGraph(g: Graph) {
    var n =null;
    if (!this.graph)
      this.layout.insertView(n= new TaskTreeItem(g, this), 0.25, 0);
    else if (g)
      this.layout.replaceViewAt(0, n= new TaskTreeItem(g, this)).destroy();
    else
      this.layout.removePart(0, true);
    this.graph = g;
    if (n) n.expand();
  }

  setTask(t: Graph) {
    (new core.async.Async(null, [
      (p) => { this.workspace.taskInfo(p, t.id); },
      (p) => { this.taskview.setTask(p.context.result, t); p.continue(); }
    ])).continue();
  }

  isViewFor(workspace) {
    return this.workspace === workspace;
  }
}

export = WorkspaceGraphView;
