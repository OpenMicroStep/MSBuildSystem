/// <reference path="../../typings/browser.d.ts" />
/* @flow */
'use strict';

declare function require(module);
import WorkspaceTreeView = require('./WorkspaceTreeView');
import EditorView = require("./EditorView");
import DockLayout = require("./DockLayout");
import View = require('./View');
import Workspace = require('./Workspace');
import globals = require('./globals');
import menu = require('./menu');

var defaultCommands= [
  { name:"file.new"  , bindKey: { win: "Ctrl-N", mac: "Command-N" } },
  { name:"file.save" , bindKey: { win: "Ctrl-S", mac: "Command-S" } },
  { name:"file.close", bindKey: { win: "Ctrl-W", mac: "Command-W" } },
];

var menus = [
  {id: "file", label: "File", submenu: [
    { label: "New File"   , command: "file.new" },
    { label: "Open"       , command: "file.open"},
    { label: "Open Recent", submenu: [{label: "TODO"}]},
    { label: "Save"       , command: "file.save"   },
    { label: "Save As"    , command: "file.saveas" },
    { label: "Save all"   , command: "file.saveall"},
    { label: "Close file" , command: "file.close"  }
  ]},
  {id: "settings", label: "Preferences", submenu: [
    { label: "Settings" }
  ]}
];

class IDE extends View {
  workspace;
  workspaceName: HTMLElement;
  content: DockLayout;
  focus: View;
  commands: AceAjax.CommandManager;
  keyBinding: AceAjax.KeyBinding;
  menu: menu.TitleMenu;
  treeView: WorkspaceTreeView;

  constructor() {
    super();

    var top = document.createElement('div');
    top.className = "navbar navbar-fixed-top navbar-default";
    this.el.appendChild(top);

    this.workspaceName = document.createElement('a');
    this.workspaceName.className = "navbar-brand";
    top.appendChild(this.workspaceName);

    this.content= new DockLayout();
    this.content.appendTo(this.el);
    this.render();

    this.workspace = new Workspace();
    this.workspace.outofsync();
    this.treeView = new WorkspaceTreeView(this.workspace);
    this.content.main.appendViewTo(this.treeView, DockLayout.Position.LEFT);

    this.menu = new menu.TitleMenu(defaultCommands, menus, this, (el) => {
      top.appendChild(el);
    });
  }

  getChildViews() : View[] {
    return [this.content];
  }

  setCurrentView(view: View) {
    this.focus = view;
  }

  exec(command) {
    if (!this.focus || !this.focus.tryDoAction(command))
      this.tryDoAction(command);
  }

  startOperation(e) {
    this.exec(e.command);
    e.preventDefault();
    e.returnValue = true;
  }
}

export = IDE;