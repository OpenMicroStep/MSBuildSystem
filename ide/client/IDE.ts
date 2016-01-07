/// <reference path="../../typings/browser.d.ts" />
/* @flow */
'use strict';

declare function require(module);
import views = require('../views');
import {menu, globals, async} from '../core';
import Workspace = require('./Workspace');

var defaultCommands= [
  { name:"file.new"                , bindKey: { win: "Ctrl-N", mac: "Command-N" } },
  { name:"file.save"               , bindKey: { win: "Ctrl-S", mac: "Command-S" } },
  { name:"file.close"              , bindKey: { win: "Ctrl-W", mac: "Command-W" } },
  { name:"workspace.gotofile"      , bindKey: { win: "Ctrl-P", mac: "Command-P" } },
  { name:"workspace.build"         , bindKey: { win: "Ctrl-B", mac: "Command-B" } },
  { name:"workspace.run"           , bindKey: { win: "Ctrl-R", mac: "Command-R" } },
  { name:"edit.undo"               , bindKey: { win: "Ctrl-Z", mac: "Command-Z" } },
  { name:"edit.redo"               , bindKey: { win: "Ctrl-Y", mac: "Command-Shift-Z" } },
  { name:"edit.cut"                , bindKey: { win: "Ctrl-X", mac: "Command-X" } },
  { name:"edit.copy"               , bindKey: { win: "Ctrl-C", mac: "Command-C" } },
  { name:"edit.paste"              , bindKey: { win: "Ctrl-V", mac: "Command-V" } },
  { name:"edit.selectall"          , bindKey: { win: "Ctrl-A", mac: "Command-A" } },
  { name:"workspace.showbuildgraph" },
  { name:"workspace.showsettings"   },
  { name:"editor.ace.touppercase"  , bindKey: { win: "Ctrl-K Ctrl-U", mac: "Command-K Command-U" } },
  { name:"editor.ace.tolowercase"  , bindKey: { win: "Ctrl-K Ctrl-L", mac: "Command-K Command-L" } },
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
  {id: "edit", label: "Edit", submenu: [
    { label: "Undo"      , role: 'undo'     , command: 'edit.undo'     },
    { label: "Redo"      , role: 'redo'     , command: 'edit.redo'     },
    { type: "separator"                                                },
    { label: 'Cut'       , role: 'cut'      , command: 'edit.cut'      },
    { label: 'Copy'      , role: 'copy'     , command: 'edit.copy'     },
    { label: 'Paste'     , role: 'paste'    , command: 'edit.paste'    },
    { label: 'Select all', role: 'selectall', command: 'edit.selectall'},
    { type: "separator" },
    { label: 'Convert case', submenu: [
      { label: "Upper case", command: "editor.ace.touppercase"         },
      { label: "Lower case", command: "editor.ace.tolowercase"         },
    ]},
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

class IDE extends views.View {
  workspace: Workspace;
  content: views.DockLayout;
  focus: views.View;
  commands: AceAjax.CommandManager;
  keyBinding: AceAjax.KeyBinding;
  menu: menu.TitleMenu;
  treeView: views.WorkspaceTreeView;

  constructor() {
    super();
    if (globals.electron)
      this.el.className = "electron";
    var top = document.createElement('div');
    top.className = "navbar navbar-fixed-top navbar-default";
    this.el.appendChild(top);
    throttle("resize", "optimizedResize");
    window.addEventListener("optimizedResize", () => {
      this.resize();
    });
    this.content= new views.DockLayout();
    this.content.appendTo(this.el);
    this.render();

    this.workspace = new Workspace();
    (new async.Async(null, [
      this.workspace.outofsync.bind(this.workspace),
      (p) => {
        this.treeView = new views.WorkspaceTreeView(this.workspace);
        this.content.main.appendViewTo(this.treeView, views.DockLayout.Position.LEFT);
      }
    ])).continue();
    this.menu = new menu.TitleMenu(defaultCommands, menus, this, (el) => {
      top.appendChild(el);
    });
  }

  getChildViews() : views.View[] {
    return [this.content];
  }

  setCurrentView(view: views.View) {
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
      case 'workspace.gotofile':
        var v = new views.WorkspaceGoToFile(this.workspace);
        v.attach();
        return true;
    }
    return false;
  }


  openFile(file) {
    return this.content.createViewIfNecessary(views.EditorView, [file]);
  }

  openSettings(workspace) {
    return this.content.createViewIfNecessary(views.WorkspaceSettingsView, [workspace]);
  }

  openBuildGraph(workspace) {
    return this.content.createViewIfNecessary(views.WorkspaceGraphView, [workspace]);
  }

  exec(command) {
    if (!this.focus || !this.focus.tryDoAction(command))
      this.tryDoAction(command);
  }

  startOperation(e) {
    this.exec(e.command);
    e.preventDefault();
    return true;
  }
}

export = IDE;