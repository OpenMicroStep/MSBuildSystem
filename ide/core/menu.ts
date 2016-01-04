/// <reference path="../../typings/browser.d.ts" />

import View = require('../views/View');
import globals = require('./globals');

var useragent = ace.require("ace/lib/useragent");
var aceevent = ace.require('ace/lib/event');
var KeyBinding = ace.require('ace/keyboard/keybinding').KeyBinding;
var CommandManager = ace.require("ace/commands/command_manager").CommandManager;

type MenuItemOptions = {
  id?: string;
  icon?: string;
  label?: string;
  sublabel?: string;
  command?: string;
  type?: string; // normal, separator, submenu, checkbox, radio
  click?: () => void;
  bindKey?: { win: string, mac: string };
  role?: string; // undo, redo, cut, copy, paste, selectall, minimize, close
  enabled?: boolean;
  visible?: boolean;
  checked?: boolean;
  submenu?: MenuItemOptions[];
}

var remote = globals.electron && globals.electron.remote;
var nativeMenu = remote && remote.Menu;
var nativeMenuItem = remote && remote.MenuItem;

function isNative() {
  return !!(nativeMenu && nativeMenuItem);
}

class Menu {
  nativeMenu;
  domMenu: HTMLElement;

  constructor(menu: MenuItemOptions[], allowBindings: boolean) {
    if (isNative()) {
      this.nativeMenu = new nativeMenu();
      menu.forEach((opts) => {
        this.nativeMenu.append(this._buildNativeMenuItem(opts, allowBindings));
      });
    }
    else {
      this.domMenu = document.createElement('ul');
      menu.forEach((opts) => {
        this._buildDomMenuItem(opts, allowBindings, this.domMenu, 0);
      });
    }
  }

  _buildDomMenuItem(opts: MenuItemOptions, allowBindings: boolean, parent: HTMLElement, level : number) {
    var dropdown, name, subMenu, subItems;
    subItems = opts.submenu || [];
    dropdown = document.createElement('li');
    parent.appendChild(dropdown);

    if (opts.type === "separator") {
      dropdown.appendChild(document.createElement('hr'));
      return;
    }
    name = document.createElement("a");
    name.setAttribute("href", "#");
    name.textContent = opts.label;
    if (opts.checked === true)
      name.className = "menuitem-checked";
    dropdown.appendChild(name);

    if (opts.command) {
      var cmd = applicationMenu.commandWithName(opts.command);
      if (cmd)
        opts.click = () => { globals.ide.exec(cmd); };
    }
    if (opts.click)
      name.addEventListener('click', opts.click, false);

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

      for (var sub of subItems) {
        this._buildDomMenuItem(sub, allowBindings, subMenu, level + 1);
      }
    }
  }

  _buildNativeKeyBind(keyBind) {
    var bind = keyBind[useragent.isMac ? "mac" : "win"];
    if (bind) {
      bind = bind.replace(/-/g, '+');
    }
    return bind;
  }
  _buildNativeMenuItemOpts(opts: MenuItemOptions, allowBindings: boolean) {
    var native: any = opts;
    if (opts.command) {
      var cmd = applicationMenu.commandWithName(opts.command);
      if (cmd) {
        opts.bindKey = cmd.bindKey;
        opts.click = () => { globals.ide.exec(cmd); };
      }
    }
    if (allowBindings && opts.bindKey)
      native.accelerator = this._buildNativeKeyBind(opts.bindKey);
    if (opts.submenu)
      native.submenu = opts.submenu.map((opts) => {
        return this._buildNativeMenuItem(opts, allowBindings);
      });
    return native;
  }
  _buildNativeMenuItem(opts: MenuItemOptions, allowBindings: boolean) {
    return new nativeMenuItem(this._buildNativeMenuItemOpts(opts, allowBindings));
  }
}

export class TitleMenu extends Menu {
  commands;
  keyBinding;

  constructor(defaultCommands, menu: MenuItemOptions[], ide, nonNativeCb: (menu: HTMLElement) => void) {
    applicationMenu = this;
    if (isNative()) {
      var settings = menu.findIndex((opts) => {
        return opts.id === "settings";
      });
      var submenu = [];
      submenu.push({ label: 'About ' + name, role: 'about' });
      submenu.push({ type: 'separator' });
      submenu.push({ label: 'Services', role: 'services', submenu: [] });
      submenu.push({ type: 'separator' });
      if (settings != -1) {
        var s = menu[settings];
        menu.splice(settings, 1);
        submenu.push(s);
        submenu.push({ type: 'separator' });
      }
      submenu.push({ label: 'Hide ' + name, accelerator: 'Command-H', role: 'hide' });
      submenu.push({ label: 'Hide Others', accelerator: 'Command-Shift-H', role: 'hideothers' });
      submenu.push({ label: 'Show All', role: 'unhide' });
      submenu.push({ type: 'separator' });
      submenu.push({ label: 'Quit', accelerator: 'Command-Q', click: function() { remote.app.quit(); }});
      menu.unshift({ label: "App", submenu: submenu});
    }
    this.commands = new CommandManager(useragent.isMac ? "mac" : "win", defaultCommands);
    this.keyBinding = new KeyBinding(this);
    aceevent.addCommandKeyListener(document, this.keyBinding.onCommandKey.bind(this.keyBinding));
    (<any>this.commands).on("exec", ide.startOperation.bind(ide), true);
    super(menu, true);
    if (this.nativeMenu) {
      this.nativeMenu.append(new nativeMenuItem({ label: 'Dev', submenu: [ {
        label: 'Reload',
        accelerator: 'CmdOrCtrl+R',
        click: function() { remote.getCurrentWindow().reload(); }
      },{
        label: 'Dev Tools',
        accelerator: 'CmdOrCtrl+Maj+I',
        click: function() { remote.getCurrentWindow().webContents.openDevTools(); }
      } ]}));
      nativeMenu.setApplicationMenu(this.nativeMenu);
    }
    else {
      this.domMenu.className = "nav menu-title";
      nonNativeCb(this.domMenu);
    }
  }

  commandWithName(name) {
    return this.commands.commands[name];
  }

  addCommand(command) {
    this.commands.addCommand(command);
  }
  removeCommand(command) {
    this.commands.removeCommand(command);
  }
}

export class ContextMenu extends Menu {
  _visible: boolean;

  constructor(menu: MenuItemOptions[]) {
    super(menu, false);
    if (this.domMenu) {
      this.domMenu.className += "dropdown-menu menu-contextmenu";
    }
  }

  popup(x: number, y: number) {
    if (this.domMenu) {
      document.body.appendChild(this.domMenu);
      var rw = $(this.domMenu).width();
      var rh = $(this.domMenu).height();
      var w = window.innerWidth;
      var h = window.innerHeight;
      this.domMenu.style.left = Math.min(x, w - rw - 5) + "px";
      if (y + rh + 15 > h && y > h / 2) {
        this.domMenu.style.bottom = (h - y) + "px";
        this.domMenu.style.maxHeight = (y - 15) + "px";
      }
      else {
        this.domMenu.style.top = y + "px";
        this.domMenu.style.maxHeight = (h - y - 15) + "px";
      }
      (<any>$(this.domMenu)).dropdown('toggle');
      var clear = () => {
        document.removeEventListener('contextmenu', clear, true);
        document.removeEventListener('click', clear, true);
        document.removeEventListener('keydown', keydown, true);
        document.body.removeChild(this.domMenu);
        $(this.domMenu).empty();
      };
      var keydown = (e) => {
        if (!/(38|40|27|32)/.test(e.which)) return;
        e.preventDefault();
        e.stopPropagation();
        clear();
      };
      document.addEventListener('contextmenu', clear, true);
      document.addEventListener('click', clear, true);
      document.addEventListener('keydown', keydown, true);
    }
    else {
      console.log(this.nativeMenu);
      this.nativeMenu.popup(remote.getCurrentWindow(), x, y);
    }
  }
}

export var applicationMenu: TitleMenu = null;

export function bindContextMenuTo(el: HTMLElement, cb: () => MenuItemOptions[]) {
  el.addEventListener("contextmenu", function(event) {
    event.preventDefault();
    var opts = cb();
    var menu = new ContextMenu(opts);
    menu.popup(event.clientX, event.clientY);
  }, true);
}
