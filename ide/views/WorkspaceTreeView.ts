/// <reference path="../../typings/browser.d.ts" />

"use strict";
import {globals, View, ContentView, TreeItemView, DockLayout, async} from '../core';
import Workspace = require('../client/Workspace');
import WorkspaceSettingsView = require('./WorkspaceSettingsView');
import EditorView = require('./EditorView');

// glyphicon glyphicon-file
// glyphicon glyphicon-folder-close
// glyphicon glyphicon-folder-open


class WorkspaceDepsTreeItem extends TreeItemView {
  constructor(private workspace: Workspace) {
    super();
    var icon = document.createElement('span');
    icon.className = "glyphicon glyphicon-flash";
    this.nameContainer.appendChild(icon);
    this.nameContainer.appendChild(document.createTextNode('dependencies'));
    this.setCanExpand(true);
  }

  createChildItems(p) {
    p.setFirstElements([
      this.workspace.dependencies.map((w) => { return (p) => {
        if (w.workspace) { p.continue(); return; }

        p.setFirstElements((p) => {
          w.workspace = p.context.result;
          p.continue();
        });
        this.workspace.openDependency(p, w.name); };
      }),
      (p) => {
        this.workspace.dependencies.forEach((w) => {
          this.addChildItem(new WorkspaceTreeItem(w.workspace));
        });
        p.continue();
      }
    ]);
    p.continue();
  }
}

class WorkspaceTreeItem extends TreeItemView {
  constructor(private workspace: Workspace) {
    super();
    workspace.on('reload', this.reload.bind(this));
    this.reload();
  }
  reload() {
    var icon = document.createElement('span');
    icon.className = "fa fa-fw fa-briefcase";
    this.nameContainer.innerHTML = '';
    this.nameContainer.appendChild(icon);
    this.nameContainer.appendChild(document.createTextNode(this.workspace.name));
    this.nameContainer.setAttribute('title', this.workspace.path);
    this.nameContainer.addEventListener("click", () => {
       globals.ide.openSettings(this.workspace);
    });
    this.removeChildItems();
    this.setCanExpand(true);
  }

  createChildItems(p) {
    if (this.workspace.dependencies.length) {
      this.addChildItem(new WorkspaceDepsTreeItem(this.workspace));
    }
    for(var f of this.workspace.files) {
      this.addChildItem(new FileTreeItem(f, this.workspace));
    }
    var file = null;
    this.addChildItem(new FileTreeItem({file:"make.js", onFocus: (view: EditorView) => {
      if (view.file != file) {
        file = view.file;
        file.on('saved', () => {
          async.run(null, this.workspace.reload.bind(this.workspace));
        });
      }
    }}, this.workspace));
    p.continue();
  }
}

class FileTreeItem extends TreeItemView {
  constructor(private d, private workspace) {
    super();
    var icon = document.createElement('span');
    var text, tooltip;
    if (d.file) {
      icon.className = "fa fa-fw fa-file";
      tooltip = d.file;
      text = d.file.replace(/^.+\//, '');
      this.nameContainer.addEventListener("click", () => {
        (new async.Async(null, [
          (p) => { workspace.openFile(p, d.file); },
          (p) => {
            var view = globals.ide.openFile(p.context.result);
            if (d.onFocus)
              d.onFocus(view);
          }
        ])).continue();
      });
      this.nameContainer.className += " tree-item-file";
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

  createChildItems(p) {
    for(var f of this.d.files) {
      this.addChildItem(new FileTreeItem(f, this.workspace));
    }
    p.continue();
  }
}

class WorkspaceTreeView extends ContentView {
  root: TreeItemView;
  constructor(workspace: Workspace) {
    super();
    this.root = new WorkspaceTreeItem(workspace);
    this.root.expand();
    this.root.appendTo(this.el);
    var progress = document.createElement('div');
    var progressAdv = document.createElement('div');
    progress.className = "progress-line";
    progress.appendChild(progressAdv);
    this.titleEl.appendChild(document.createTextNode("Workspace"));
    this.titleEl.appendChild(progress);
    $(progress).hide();
    workspace.on('build', (e) => {
      if (e.working) $(progress).show();
      else $(progress).fadeOut();
      $(progressAdv).css('width', (e.progress * 100) + '%');
    });
  }

  getChildViews() {
    return [this.root];
  }
}

export = WorkspaceTreeView;
