/// <reference path="../../typings/browser.d.ts" />

"use strict";
import View = require('./View');
import TreeView = require('./TreeView');
import Workspace = require('./Workspace');
import DockLayout = require('./DockLayout');
import EditorView = require('./EditorView');
import globals = require('./globals');

// glyphicon glyphicon-file
// glyphicon glyphicon-folder-close
// glyphicon glyphicon-folder-open

function openFile(file) {
  var found = false;
  globals.ide.content.iterateViews((view, container) => {
    if (view instanceof EditorView && (<EditorView>view).file === file) {
      container.currentView = view;
      container.currentView.focus();
      found = true;
    }
    return found;
  });
  if (!found) {
    var ed = new EditorView(file);
    globals.ide.content.main.appendViewTo(ed, DockLayout.Position.MIDDLE);
    ed.focus();
  }
}

class WorkspaceTreeItem extends TreeView.TreeItem {
  constructor(workspace) {
    super();
    workspace.on('reload', (e) => {
      this.removeChildItems();
      var icon = document.createElement('span');
      icon.className = "glyphicon glyphicon-briefcase";
      this.nameContainer.innerHTML = '';
      this.nameContainer.appendChild(icon);
      this.nameContainer.appendChild(document.createTextNode(workspace.name));
      this.nameContainer.setAttribute('title', workspace.path);
      /*this.nameContainer.addEventListener("click", () => {
          workspace.openFile('make.js').then(openFile);
      });*/
      for(var f of workspace.files) {
        this.addChildItem(new FileTreeItem(f, workspace));
      }
      this.addChildItem(new FileTreeItem({file:"make.js"}, workspace));
    });
  }
}
class FileTreeItem extends TreeView.TreeItem {
  constructor(d, workspace) {
    super();

    var icon = document.createElement('span');
    var text, tooltip;
    if (d.file) {
      icon.className = "glyphicon glyphicon-file";
      tooltip = d.file;
      text = d.file.replace(/^.+\//, '');
      this.nameContainer.addEventListener("click", () => {
        workspace.openFile(d.file).then(openFile);
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

class WorkspaceTreeView extends TreeView {
  constructor(workspace: Workspace) {
    super("Workspace");
    this.root = new WorkspaceTreeItem(workspace);
    this.el.appendChild(this.root.el);
  }
}

export = WorkspaceTreeView;
