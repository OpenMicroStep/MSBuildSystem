declare function require(module);
import views = require('../views');
import {menu, globals, async, replication} from '../core';
import Session = require('./Session');
import Workspace = require('./Workspace');
import WorkspaceFile = require('./WorkspaceFile');
import Async = async.Async;


var defaultCommands= [
  { name:"file.new"                , bindKey: { win: "Ctrl-N", mac: "Command-N" } },
  { name:"file.save"               , bindKey: { win: "Ctrl-S", mac: "Command-S" } },
  { name:"file.close"              , bindKey: { win: "Ctrl-W", mac: "Command-W" } },
  { name:"file.gotofile"           , bindKey: { win: "Ctrl-P", mac: "Command-P" } },
  { name:"workspace.build"         , bindKey: { win: "Ctrl-B", mac: "Command-B" } },
  { name:"workspace.run"           , bindKey: { win: "Ctrl-R", mac: "Command-R" } },
  { name:"edit.undo"               , bindKey: { win: "Ctrl-Z", mac: "Command-Z" } },
  { name:"edit.redo"               , bindKey: { win: "Ctrl-Y", mac: "Command-Shift-Z" } },
  { name:"edit.cut"  , native: true, bindKey: { win: "Ctrl-X", mac: "Command-X" } },
  { name:"edit.copy" , native: true, bindKey: { win: "Ctrl-C", mac: "Command-C" } },
  { name:"edit.paste", native: true, bindKey: { win: "Ctrl-V", mac: "Command-V" } },
  { name:"edit.selectall"          , bindKey: { win: "Ctrl-A", mac: "Command-A" } },
  { name:"find.findinfiles"        , bindKey: { win: "Ctrl-Shift-F", mac: "Command-Shift-F" } },
  { name:"workspace.showbuildgraph" },
  { name:"workspace.showsettings"   },
  { name:"workspace.showdiagnostics"},
  { name:"view.openterminal"        },
  { name:"view.resetlayout"         },
  { name:"edit.touppercase"        , bindKey: { win: "Ctrl-K Ctrl-U", mac: "Command-K Command-U" } },
  { name:"edit.tolowercase"        , bindKey: { win: "Ctrl-K Ctrl-L", mac: "Command-K Command-L" } },
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
  {id: "view", label: "View", submenu: [
    { label: "Open terminal"      , command: "view.openterminal"       },
    { label: "Reset layout"       , command: "view.resetlayout"        },
  ]},
  {id: "workspace", label: "Workspace", submenu: [
    { label: "Build"              , command: "workspace.build"         },
    { label: "Run"                , command: "workspace.run"           },
    { type: "separator" },
    { label: "Diagnostics"        , command: "workspace.showdiagnostics"},
    { label: "Build Graph"        , command: "workspace.showbuildgraph"},
    { label: "Settings"           , command: "workspace.showsettings"  },
  ]},
  {id: "settings", label: "Preferences", submenu: [
    { label: "Settings (TODO)" }
  ]}
];

var defaultLayout = { type: "hbox", items: [
  { type: "tabs", size: 0.25, tabs: [
    { type: "treeview" }
  ]},
  { type: "main", size: 0.75, tabs: [] },
]};


var throttle = function(fn) {
  var running = null;
  var func = function() {
    if (running) { return; }
    running = function() {
      fn();
      running = null;
    };
    requestAnimationFrame(running);
  };
  return func;
};

class IDEStatus extends views.View {
  $statusContent: JQuery; $progression; $build; $run; $clean; $runner;
  status: { label: string, warnings: number, errors: number, progression: number };
  runners: { runner: {name: string}, workspace: Workspace, envs: string[] }[];
  runner; env; variant;

  constructor(ide: IDE) {
    super();
    this.el.className = "navbar-status";
    var btngroup = $('<div class="btn-group"/>').appendTo(this.$el);
    var status = $('<div class="ide-status"/>').appendTo(btngroup);
    this.$statusContent = $('<div><i class="fa fa-circle-o-notch fa-spin"></i></div>').appendTo(status);

    var progress = $('<div class="progress-line">').appendTo(status);
    this.$progression = $('<div/>').appendTo(progress);
    this.$build = $('<button class="btn btn-default" title="Build"><i class="fa fa-cogs"></i></button>').appendTo(btngroup);
    this.$clean = $('<button class="btn btn-default" title="Clean"><i class="fa fa-recycle"></i></button>').appendTo(btngroup);
    this.$runner = $('<button class="btn btn-default" title="Current run"></button>').appendTo(btngroup);
    this.$run = $('<button class="btn btn-default" title="Run"><i class="fa fa-play"></i></button>').appendTo(btngroup);
    this.status = { label: "", warnings: 0, errors: 0, progression: 0 };
    this.runner = null;
    this.runners = [];
    this.$build.click(() => { async.run(null, (p) => { ide.session.build(p); }); });
    this.$clean.click(() => { async.run(null, (p) => { ide.session.clean(p); }); });
    this.$runner.click(() => {
      var dropdown = new menu.Dropdown(this.runners.map((r) => {
        return {
          label: r.runner.name,
          click: this.setRunner.bind(this, r, null, null),
          checked: r === this.runner,
          submenu: () => { return r.envs.map((e) => {
            return {
              label: e,
              click: this.setRunner.bind(this, r, e, null),
              checked: r === this.runner && this.env === e,
              submenu: () => { return r.workspace.variants.map((v) => {
                return {
                  label: v,
                  type: "checkbox",
                  click: this.setRunner.bind(this, r, e, v),
                  checked: r === this.runner && this.env === e && this.variant === v
                }
              });}
            }
          });}
        }
      }));
      dropdown.showRelativeToElement(this.$runner[0], 'bottom');
    });
    this.$run.click(ide.exec.bind(ide, null, { name: "workspace.run" }));
    ide.session.on('status', (e) => {
      var lbl;
      if (e.state === "build")
        lbl = e.working ? "Building..." : (e.errors ? "Build failed" : "Build succeeded");
      else if (e.state === "graph")
        lbl = "Creating build graph...";
      else if (e.state === "clean")
        lbl = e.working ? "Cleaning..." : (e.errors ? "Clean failed" : "Clean succeeded");

      this.setStatus({
        label: lbl,
        progression: e.progress,
        warnings: e.warnings,
        errors: e.errors,
      });
    });
  }

  _changes(list: string[], o, n) {
    var change = false;
    list.forEach((k) => {
      var x;
      if ((x = n[k]) !== void 0 && x !== o[k]) {
        o[k] = x;
        change= true;
      }
    });
    return change;
  }

  setStatus(status: { label?: string, warnings?: number, errors?: number, progression?: number, error?: any }) {
    if (status.error) {
      status.label = typeof status.error === "string" ? status.error : status.error.msg;
      status.errors = this.status.errors + 1;
    }
    if (this._changes(["label", "warnings", "errors", "progression"], this.status, status))
      this.renderStatus();
  }

  setRunner(r, e, v) {
    this.runner = r;
    this.env = e ? e : (r ? r.envs.find((re) => { return re == this.env; }) || r.envs[0] : null);
    this.variant = v ? v : (r ? r.workspace.variants.find((rv) => { return rv == this.variant}) || r.workspace.variants[0] : null);
    this.$runner
      .text(r ? r.runner.name : "No runner")
      .attr("title", r ? (r.runner.name + " | " + (this.env || "No environment") + " | " + (this.variant || "No variant")) : "No runner")
  }

  loadRunners(w: Workspace) {
    this.runners = [];
    var ws = new Set<Workspace>();
    var load = (w: Workspace) => {
      if (ws.has(w)) return;
      ws.add(w);
      w.runs.forEach((r) => {
        var commonenvs: Set<string> = null;
        if (r.dependencies) {
          var envs = null;
          var resolve = (envname) => {
            var e = w.environments.find((e) => { return e.name === envname; });
            if (e && e.contains)
              e.contains.forEach(resolve);
            else if (e)
              envs.add(e.name);
          }
          r.dependencies.forEach((d: string) => {
            var t = w.targets.find((t) => { return t.name === d });
            if (t && t.environments) {
              envs= new Set<string>();
              t.environments.forEach(resolve);
              if (!commonenvs)
                commonenvs = envs;
              else {
                Array.from(commonenvs).forEach((env) => {
                  if (!envs.has(env))
                    commonenvs.delete(env);
                });
              }
            }
          });
        }
        this.runners.push({
          runner: r,
          workspace: w,
          envs: Array.from(commonenvs)
        });
      });
      w.dependencies.forEach((d) => { load(d.workspace); });
    }
    load(w);
    this.setRunner(this.runners[0], null, null);
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
function _commandCreateView(view, args) {
  return function(p) {
    this.content.createViewIfNecessary(view, args);
    p.continue();
  }
}
class IDE extends views.View {
  session: Session;
  content: views.DockLayout;
  _focus: views.ContentView;
  commands: { [s:string]: (p: Async, args?: any) => void };
  keyBinding: AceAjax.KeyBinding;
  menu: menu.TitleMenu;
  _serverstatus: HTMLElement;
  _status: IDEStatus;
  _gotofile: views.GoToFile;

  constructor() {
    super();
    if (globals.electron)
      this.el.className = "electron";
    var top = document.createElement('div');
    top.className = "navbar navbar-fixed-top navbar-default";
    this.el.appendChild(top);
    window.addEventListener("resize", throttle(() => {
      this.resize();
    }));
    this.content= new views.DockLayout();
    this.content.on("layoutChange", () => {
      this.session.set('layout', this.content.serialize());
    });
    this.content.appendTo(this.el);
    this.render();
    this.session = new Session();
    this.session.on("ready", () => {
      this._status.setStatus({ label: "Idle" });
      this.content.deserialize(this.session.get('layout', defaultLayout));
      //this.treeView = new views.WorkspaceTreeView(this.session.workspace);
      //this.content.main.appendViewTo(this.treeView, views.DockLayout.Position.LEFT);
      this._status.loadRunners(this.session.workspace);
    });
    this.session.on("error", () => {
      this._status.setStatus({ label: "Error while loading workspace" });
    });

    this._serverstatus = document.createElement('i');
    this._serverstatus.className = "fa fa-fw fa-circle";
    this._serverstatus.title = "Connection status";
    top.appendChild(this._serverstatus);
    $(this._serverstatus).toggleClass("text-danger", !replication.socket.connected);
    replication.socket.on('connect', () => {
      $(this._serverstatus).removeClass('text-danger');
    });
    replication.socket.on('disconnect', () => {
      $(this._serverstatus).addClass('text-danger');
    });

    this._status = new IDEStatus(this);
    this._status.appendTo(top);

    this.menu = new menu.TitleMenu(defaultCommands, menus, this, (el) => {
      top.insertBefore(el, this._serverstatus);
    });
    this.commands = {
      'workspace.showsettings'   : _commandCreateView(views.WorkspaceSettingsView, []).bind(this),
      'workspace.showbuildgraph' : _commandCreateView(views.SessionGraphView, []).bind(this),
      'workspace.showdiagnostics': _commandCreateView(views.DiagnosticsView, []).bind(this),
      'workspace.build': (p) => { this.session.build(p); },
      'workspace.run': (p) => {
        var status = this._status;
        if (status.runner && status.env && status.variant) {
          p.setFirstElements((p) => {
            if (p.context.error)
              this._status.setStatus({ error: p.context.error });
            else {
              var run = p.context.result;
              this.content.createViewIfNecessary(views.TerminalView, [run]);
              run.spawn(p);
            }
            p.continue();
          });
          this.session.run(p, status.runner.runner.name, status.env, status.variant);
        }
        else
          p.continue();
      },
      'file.gotofile': (p) => {
        if (!this._gotofile) {
          this._gotofile = new views.GoToFile();
          this._gotofile.attach();
          this._gotofile.once('destroy', () => { this._gotofile = null });
        }
        else {
          this._gotofile.focus();
        }
        p.continue();
      },
      'file.open': (p, args) => {
        if (args) {
          this.openFile(p, args);
        }
        else {
          //TODO Ask the user the file to open
          p.continue();
        }
      },
      'find.findinfiles'             : _commandCreateView(views.SearchInFiles, []).bind(this),
      'view.resetlayout': (p) => {
        this.content.deserialize(defaultLayout);
        p.continue();
      },
      'view.openterminal': (p) => {
        p.setFirstElements([
          (p) => { this.session.remoteCall(p, "terminal"); },
          (p) => {
            var tty = p.context.result;
            this.content.createViewIfNecessary(views.TerminalView, [tty]);
            tty.spawn(p);
          }
        ]);
        p.continue();
      }
    };
  }

  getChildViews() : views.View[] {
    return [this.content];
  }

  setCurrentView(view: views.ContentView) {
    this._focus = view;
  }

  tryDoAction(p, command) {
    var cmd = this.commands[command.name];
    if (cmd)
      cmd(p, command.args);
    return !!cmd;
  }

  openFile(p: Async, opts: { path: string, row?: number, col?: number, duplicate?: boolean }) {
    if (opts.duplicate)
      p.context.view = new views.EditorView({ path: opts.path });
    else
      p.context.view = this.content.createViewIfNecessary(views.EditorView, [{ path: opts.path }]);
    p.context.view.goTo(opts);
    p.continue();
  }

  exec(p, command) {
    if (!p) {
      async.run(null, (p) => { this.exec(p, command); });
      return;
    }
    if (!this._focus || !this._focus.tryDoAction(p, command))
      this.tryDoAction(p, command);
  }
  startOperation(e) {
    this.exec(null, e.command);
    e.preventDefault();
    return true;
  }
}

(<any>window)._Async = Async;

export = IDE;