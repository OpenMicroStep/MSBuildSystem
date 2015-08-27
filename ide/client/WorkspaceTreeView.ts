/// <reference path="../../typings/browser.d.ts" />

"use strict";
import View = require('./View');
import TreeView = require('./TreeView');
import Workspace = require('./Workspace');
import DockLayout = require('./DockLayout');
import EditorView = require('./EditorView');

// glyphicon glyphicon-file
// glyphicon glyphicon-folder-close
// glyphicon glyphicon-folder-open

class WorkspaceTreeItem extends TreeView.TreeItem {
  constructor(workspace) {
    super();

    var icon = document.createElement('span');
    icon.className = "glyphicon glyphicon-briefcase";
    this.el.appendChild(icon);
    this.el.appendChild(document.createTextNode(workspace.path));
    this.el.appendChild(this.childsContainer);
    for(var f of workspace.files) {
      var v = new FileTreeItem(f, workspace);
      this.childs.push(v);
      this.childsContainer.appendChild(v.el);
    }
  }
}
class FileTreeItem extends TreeView.TreeItem {
  constructor(d, workspace) {
    super();

    var icon = document.createElement('span');
    var text;
    if (d.file) {
      icon.className = "glyphicon glyphicon-file";
      text = document.createTextNode(d.file);
      this.el.addEventListener("click", () => {
        workspace.openFile(d.file).then((file) => {
          (<any>window).ide.content.main.appendViewTo(new EditorView(file), DockLayout.Position.MIDDLE)
        });
      }, true);
    }
    else {
      icon.className = "glyphicon glyphicon-folder-open";
      text = document.createTextNode(d.group);
      for(var f of d.files) {
        var v = new FileTreeItem(f, workspace);
        this.childs.push(v);
        this.childsContainer.appendChild(v.el);
      }
    }
    this.el.appendChild(icon);
    this.el.appendChild(text);
    this.el.appendChild(this.childsContainer);
  }
}

class WorkspaceTreeView extends TreeView {
  constructor(workspace: Workspace) {
    super("Workspace");
    this.root = new WorkspaceTreeItem(workspace);
    this.el.appendChild(this.root.el);
  }
}

export = WorkspaceTreeView;
