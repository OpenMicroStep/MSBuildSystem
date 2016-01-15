/// <reference path="../../typings/browser.d.ts" />
/* @flow */
'use strict';

declare function require(module);
import views = require('../views');
import {menu, globals, async} from '../core';
import Workspace = require('./Workspace');
import WorkspaceFile = require('./WorkspaceFile');
import Async = async.Async;

interface FindOptions {
  regexp       : boolean,
  casesensitive: boolean,
  wholeword    : boolean,
  showcontext  : number,
  searchtext   : string,
  filter       : string,
  preservecase : boolean,
};

interface ReplaceOptions extends FindOptions {
  replacement  : string,
};

var defaultCommands= [
  { name:"file.new"                , bindKey: { win: "Ctrl-N", mac: "Command-N" } },
  { name:"file.save"               , bindKey: { win: "Ctrl-S", mac: "Command-S" } },
  { name:"file.close"              , bindKey: { win: "Ctrl-W", mac: "Command-W" } },
  { name:"file.gotofile"           , bindKey: { win: "Ctrl-P", mac: "Command-P" } },
  { name:"workspace.build"         , bindKey: { win: "Ctrl-B", mac: "Command-B" } },
  { name:"workspace.run"           , bindKey: { win: "Ctrl-R", mac: "Command-R" } },
  { name:"edit.undo"               , bindKey: { win: "Ctrl-Z", mac: "Command-Z" } },
  { name:"edit.redo"               , bindKey: { win: "Ctrl-Y", mac: "Command-Shift-Z" } },
  { name:"edit.cut"                , bindKey: { win: "Ctrl-X", mac: "Command-X" } },
  { name:"edit.copy"               , bindKey: { win: "Ctrl-C", mac: "Command-C" } },
  { name:"edit.paste"              , bindKey: { win: "Ctrl-V", mac: "Command-V" } },
  { name:"edit.selectall"          , bindKey: { win: "Ctrl-A", mac: "Command-A" } },
  { name:"find.findinfiles"        , bindKey: { win: "Ctrl-Shift-F", mac: "Command-Shift-F" } },
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

class IDEStatus extends views.View {
  $statusContent: JQuery; $progression; $build; $run; $clean;
  status: { label: string, warnings: number, errors: number, progression: number }

  constructor(ide: IDE) {
    super();
    this.el.className = "navbar-status";
    var btngroup = $('<div class="btn-group"/>').appendTo(this.$el);
    var status = $('<div class="ide-status"/>').appendTo(btngroup);
    this.$statusContent = $('<div/>').appendTo(status);

    var progress = $('<div class="progress-line">').appendTo(status);
    this.$progression = $('<div/>').appendTo(progress);
    this.$build = $('<button class="btn btn-default" title="Build"><i class="fa fa-cogs"></i></button>').appendTo(btngroup);
    this.$run = $('<button class="btn btn-default" title="Run"><i class="fa fa-play"></i></button>').appendTo(btngroup);
    this.$clean = $('<button class="btn btn-default" title="Clean"><i class="fa fa-recycle"></i></button>').appendTo(btngroup);
    this.status = { label: "", warnings: 0, errors: 0, progression: 0 };
    this.$build.click(() => { async.run(null, (p) => { ide.build(p); }); });
    //this.$run.click(() => { async.run(null, (p) => { ide.run(p); }); });
    //this.$clean.click(() => { async.run(null, (p) => { ide.clean(p); }); });
  }

  setStatus(status: { label?: string, warnings?: number, errors?: number, progression?: number }) {
    var change = false;
    ["label", "warnings", "errors", "progression"].forEach((k) => {
      var x;
      if ((x = status[k]) !== void 0 && x !== this.status[k]) {
        this.status[k] = x;
        change= true;
      }
    });
    if (change)
      this.renderStatus();
  }

  renderStatus() {
    this.$progression.toggleClass('text-danger', this.status.progression === 1 && this.status.errors > 0);
    this.$progression.toggleClass('text-success', this.status.progression === 1 && this.status.errors === 0);
    this.$progression.css('width', (this.status.progression * 100) + '%');
    this.$statusContent.text(this.status.label);
    if (this.status.warnings > 0 || this.status.errors > 0) {
      var $badge = $('<span class="pull-right"/>').prependTo(this.$statusContent);
      if (this.status.warnings > 0)
        $badge.append(' <span class="badge-warning">'+this.status.warnings+'</span>');
      if (this.status.errors > 0)
        $badge.append(' <span class="badge-error">'+this.status.errors+'</span>');
    }
  }
}

class IDE extends views.View {
  workspace: Workspace;
  content: views.DockLayout;
  focus: views.View;
  commands: AceAjax.CommandManager;
  keyBinding: AceAjax.KeyBinding;
  menu: menu.TitleMenu;
  treeView: views.WorkspaceTreeView;
  _openFiles: Map<string, Async>;
  _serverstatus: HTMLElement;
  _status: IDEStatus;

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
    this._openFiles = new Map<any, any>();
    this.content= new views.DockLayout();
    this.content.appendTo(this.el);
    this.render();

    this.workspace = new Workspace();
    this.workspace.on('build', (e) => {
      var lbl;
      if (e.state === "done")
        lbl = (e.errors ? "Build failed" : "Build succeeded");
      else if (e.state === "graph")
        lbl = "Creating build graph...";
      else
        lbl = "Building...";

      this._status.setStatus({
        label: lbl,
        progression: e.progress,
        warnings: e.warnings,
        errors: e.errors,
      });
    });
    (new Async(null, [
      this.workspace.outofsync.bind(this.workspace),
      (p) => {
        this.treeView = new views.WorkspaceTreeView(this.workspace);
        this.content.main.appendViewTo(this.treeView, views.DockLayout.Position.LEFT);
      }
    ])).continue();

    this._serverstatus = document.createElement('i');
    this._serverstatus.className = "fa fa-fw fa-circle";
    top.appendChild(this._serverstatus);

    this._status = new IDEStatus(this);
    this._status.appendTo(top);
    this._status.setStatus({ label: "Idle" });

    this.menu = new menu.TitleMenu(defaultCommands, menus, this, (el) => {
      top.insertBefore(el, this._serverstatus);
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
        var files
        async.run(null, this.build.bind(this));
        return true;
      case 'workspace.showsettings':
        this.openSettings(this.workspace);
        return true;
      case 'workspace.showbuildgraph':
        this.openBuildGraph(this.workspace);
        return true;
      case 'file.gotofile':
        var v = new views.GoToFile();
        v.attach();
        return true;
      case 'find.findinfiles':
        this.content.createViewIfNecessary(views.SearchInFiles, []);
        return true;
    }
    return false;
  }

  build(p: Async) {
    var s = [];
    this._openFiles.forEach((once) => {
      s.push(new Async(null, [
        once,
        (p) => {
          var file = once.context.result;
          if (file && file.hasUnsavedChanges())
            file.save(p, file);
          else
            p.continue();
        }
      ]));
    });
    p.setFirstElements([
      s,
      this.workspace.build.bind(this.workspace)
    ]);
    p.continue();
  }

  find(p: Async, options: FindOptions) {
    this.workspace.remoteCall(p, "find", options);
  }

  replace(p: Async, options: ReplaceOptions) {
    this.workspace.remoteCall(p, "replace", options);
  }

  openFile(p: Async, path) {
    var once = this._openFiles.get(path);
    if (!once) {
      once = new Async(null, Async.once([
        (p) => { this.workspace.remoteCall(p, "openFile", path); },
        (p) => {
          var file: WorkspaceFile = p.context.result;
          var workspace = Workspace.workspaces[file.path];
          if (workspace) {
            file.on('saved', () => { async.run(null, workspace.reload.bind(this)); });
          }
          file.on('destroy', () => {
            this._openFiles.delete(path);
          });
          p.continue();
          setTimeout(() => { file.unref(); }, 0);
        }
      ]));
      this._openFiles.set(path, once);
    }
    p.setFirstElements([
      once,
      (p) => {
        p.context.file = once.context.result;
        p.context.view = this.content.createViewIfNecessary(views.EditorView, [p.context.file])
        p.continue();
      }
    ]);
    p.continue();
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

(<any>window)._Async = Async;

export = IDE;