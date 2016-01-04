/// <reference path="../../typings/browser.d.ts" />
/* @flow */
'use strict';

declare function require(module);
import {View, DockLayout, EditorView, WorkspaceTreeView, WorkspaceSettingsView, WorkspaceGraphView} from '../views';
import {menu, globals, async} from '../core';
import Workspace = require('./Workspace');

var defaultCommands= [
  { name:"file.new"                , bindKey: { win: "Ctrl-N", mac: "Command-N" } },
  { name:"file.save"               , bindKey: { win: "Ctrl-S", mac: "Command-S" } },
  { name:"file.close"              , bindKey: { win: "Ctrl-W", mac: "Command-W" } },
  { name:"workspace.build"         , bindKey: { win: "Ctrl-B", mac: "Command-B" } },
  { name:"workspace.run"           , bindKey: { win: "Ctrl-R", mac: "Command-R" } },
  { name:"workspace.showbuildgraph" },
  { name:"workspace.showsettings"   },
];

var menus = [
  {id: "file", label: "File", submenu: [
    { label: "New File (TODO)"    , command: "file.new" },
    { label: "Open (TODO)"        , command: "file.open"},
    { label: "Open Recent (TODO)" , submenu: [{label: "TODO"}]},
    { label: "Save"               , command: "file.save"   },
    { label: "Save As (TODO)"     , command: "file.saveas" },
    { label: "Save all"           , command: "file.saveall"},
    { label: "Close file"         , command: "file.close"  },
  ]},
  {id: "workspace", label: "Workspace", submenu: [
    { label: "Settings"           , command: "workspace.showsettings"  },
    { label: "Build Graph"        , command: "workspace.showbuildgraph"},
    { label: "Build"              , command: "workspace.build"         },
    { label: "Run (TODO)"         , command: "workspace.run"           },
  ]},
  {id: "settings", label: "Preferences", submenu: [
    { label: "Settings (TODO)" }
  ]}
];

var throttle = function(type, name, obj?) {
  obj = obj || window;
  var running = false;
  var func = function() {
      if (running) { return; }
      running = true;
      requestAnimationFrame(function() {
          obj.dispatchEvent(new CustomEvent(name));
          running = false;
      });
  };
  obj.addEventListener(type, func);
};

class IDE extends View {
  workspace: Workspace;
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
    throttle("resize", "optimizedResize");
    window.addEventListener("optimizedResize", () => {
      this.resize();
    });
    this.content= new DockLayout();
    this.content.appendTo(this.el);
    this.render();

    this.workspace = new Workspace();
    (new async.Async(null, [
      this.workspace.outofsync.bind(this.workspace),
      (p) => {
        this.treeView = new WorkspaceTreeView(this.workspace);
        this.content.main.appendViewTo(this.treeView, DockLayout.Position.LEFT);
      }
    ])).continue();
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

  tryDoAction(command) {
    switch (command.name) {
      case 'workspace.build':
        (new async.Async(null, this.workspace.build.bind(this.workspace))).continue();
        return true;
      case 'workspace.showsettings':
        this.openSettings(this.workspace);
        return true;
      case 'workspace.showbuildgraph':
        this.openBuildGraph(this.workspace);
        return true;
    }
    return false;
  }


  openFile(file) {
    this.content.createViewIfNecessary(EditorView, [file]);
  }

  openSettings(workspace) {
    this.content.createViewIfNecessary(WorkspaceSettingsView, [workspace]);
  }

  openBuildGraph(workspace) {
    this.content.createViewIfNecessary(WorkspaceGraphView, [workspace]);
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