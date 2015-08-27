/// <reference path="../../typings/browser.d.ts" />
/* @flow */
'use strict';

import WorkspaceTreeView = require('./WorkspaceTreeView');
import EditorView = require("./EditorView");
import DockLayout = require("./DockLayout");
import View = require('./View');
import Workspace = require('./Workspace');

var actions= {
  "file.new": {},
  "file.close": {},
  "edit.undo": {},
  "edit.redo": {},
};

var menu = [
  {
    name: "File",
    items: [
      {
        name: "New",
        action: "file.new",
      },
      {
        name: "Open recents",
        items: [
          { name: "Test" },
          { name: "Test 2" },
        ]
      },
    ]
  },
];

class IDE extends View {
  /**
   * GET files => FileTree
   * POST addFile(file: FileInfo, parent: id)
   * POST chgFile(changes: );
   * POST swpFile(file1: id, file2: id)
   *
   * GET targets(): TargetInfo[]
   * POST addTarget(target: TargetInfo)
   * POST chgTarget(changes: );
   * POST swpTarget(target1: id, target2: id)
   *
   * POST save()
   *
   * GET fileContent(): string
   * POST chgContent(start: number, length: number, by: string)
   *
   *
   */
  workspace;
  workspaceName: HTMLElement;
  menu: HTMLElement;
  content: DockLayout;

  constructor() {
    super();

    var top = document.createElement('div');
    top.className = "navbar navbar-fixed-top navbar-default";
    this.el.appendChild(top);


    this.workspaceName = document.createElement('a');
    this.workspaceName.className = "navbar-brand";
    top.appendChild(this.workspaceName);

    this.menu = document.createElement('ul');
    this.menu.className = "nav navbar-nav";
    top.appendChild(this.menu);

    this.content= new DockLayout();
    this.content.appendTo(this.el);
    this.render();

    this.workspace = new Workspace();
    this.workspace.outofsync().then(() => {
      this.content.main.appendViewTo(new WorkspaceTreeView(this.workspace), DockLayout.Position.LEFT);
    });
  }

  getChildViews() : View[] {
    return [this.content];
  }

  renderMenuItem(item, parent: HTMLElement, level : number) {
    var dropdown, name, subMenu, subItems;
    subItems = item.items || [];
    dropdown = document.createElement('li');
    parent.appendChild(dropdown);

    name = document.createElement("a");
    name.setAttribute("href", "#");
    name.textContent = item.name;
    dropdown.appendChild(name);

    if (subItems.length) {
      dropdown.className = level == 0 ? "dropdown" : "dropdown-submenu";

      if (level == 0) {
        name.setAttribute("data-toggle", "dropdown");
        name.setAttribute("aria-haspopup", "true");
        name.setAttribute("aria-expanded", "false");
      }

      subMenu = document.createElement("ul");
      subMenu.className = "dropdown-menu";
      dropdown.appendChild(subMenu);

      for (item of subItems) {
        this.renderMenuItem(item, subMenu, level + 1);
      }
    }

  }

  render() {
    for (var item of menu) {
      this.renderMenuItem(item, this.menu, 0);
    }
  }
}

export = IDE;