/// <reference path="../../typings/browser.d.ts" />

"use strict";
import {globals, View, ContentView, TreeItemView, DockLayout, async} from '../core';
import Workspace = require('../client/Workspace');
import WorkspaceSettingsView = require('./WorkspaceSettingsView');
import EditorView = require('./EditorView');

// glyphicon glyphicon-file
// glyphicon glyphicon-folder-close
// glyphicon glyphicon-folder-open

class WorkspaceTreeItem extends TreeItemView {
  constructor(private workspace: Workspace) {
    super();
    workspace.on('reload', this.reload.bind(this));
    this.reload();
  }
  reload() {
    var workspace = this.workspace;
    this.removeChildItems();
    var icon = document.createElement('span');
    icon.className = "glyphicon glyphicon-briefcase";
    this.nameContainer.innerHTML = '';
    this.nameContainer.appendChild(icon);
    this.nameContainer.appendChild(document.createTextNode(workspace.name));
    this.nameContainer.setAttribute('title', workspace.path);
    this.nameContainer.addEventListener("click", () => {
       globals.ide.openSettings(workspace);
    });
    for(var f of workspace.files) {
      this.addChildItem(new FileTreeItem(f, workspace));
    }
    var file = null;
    this.addChildItem(new FileTreeItem({file:"make.js", onFocus: (view: EditorView) => {
      if (view.file != file) {
        file = view.file;
        file.on('saved', () => {
          async.run(null, this.workspace.reload.bind(this.workspace));
        });
      }
    }}, workspace));
  }
}
class FileTreeItem extends TreeItemView {
  constructor(d, workspace) {
    super();

    var icon = document.createElement('span');
    var text, tooltip;
    if (d.file) {
      icon.className = "glyphicon glyphicon-file";
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
      icon.className = "glyphicon glyphicon-folder-close";
      text = d.group;
      for(var f of d.files) {
        this.addChildItem(new FileTreeItem(f, workspace));
      }
      var closed = true;
      this.nameContainer.addEventListener("click", () => {
        closed = !closed;
        $(icon).toggleClass("glyphicon-folder-open", !closed);
        $(icon).toggleClass("glyphicon-folder-close", closed);
        $(this.el).toggleClass("tree-item-closed", closed);
      });
      this.nameContainer.className += " tree-item-group";
      $(this.el).toggleClass("tree-item-closed", true);
    }
    this.nameContainer.appendChild(icon);
    this.nameContainer.appendChild(document.createTextNode(" " + text));
    if (tooltip)
      this.nameContainer.setAttribute("title", tooltip);
  }
}

class WorkspaceTreeView extends ContentView {
  root: TreeItemView;
  constructor(workspace: Workspace) {
    super();
    this.root = new WorkspaceTreeItem(workspace);
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
