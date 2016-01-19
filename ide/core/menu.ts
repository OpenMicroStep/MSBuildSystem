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
  submenu?: MenuItemOptions[] | (() => MenuItemOptions[]);
}

var remote = globals.electron && globals.electron.remote;
var nativeMenu = remote && remote.Menu;
var nativeMenuItem = remote && remote.MenuItem;

function isNative() {
  return !!(nativeMenu && nativeMenuItem);
}


var menus: { menu: HTMLElement, clear: () => void }[] = [];
var onclear = new Set<() => void>();
var menusParent = document.createElement('div');
menusParent.className = "menus";
document.body.appendChild(menusParent);

function popup(menu: HTMLElement, r: ClientRect, side: string, clear?: () => void) : string {
  menusParent.appendChild(menu);
  var rw = $(menu).width();
  var rh = $(menu).height();
  var w = window.innerWidth;
  var h = window.innerHeight;
  var c = document.createElement('div');
  if (side === "right" && r.right + rw > w)
    side = "left";

  if (side === 'bottom') {
    c.className = "menu-bottom";
    menu.style.top = r.bottom + "px";
    menu.style.left = r.left + "px";
  }
  else if (side === 'top') {
    c.className = "menu-top";
    menu.style.bottom = h - r.top + "px";
    menu.style.left = r.left + "px";
  }
  else if (side === 'right' || side === "left") {
    c.className = "menu-" + side;
    if (side === 'right')
      menu.style.left = r.right + "px";
    else
      menu.style.left = r.left - rw + "px";
    if (r.top + rh > h && r.bottom + h/2 > h) {
      menu.style.maxHeight = r.top - 15 + "px";
      menu.style.bottom = h - r.bottom + "px";
    }
    else {
      menu.style.top = r.top + "px";
      menu.style.maxHeight = h - r.top - 15 + "px";
    }
  }
  menu.style.display = "block";
  c.appendChild(menu);
  menusParent.appendChild(c);
  menus.push({ menu: c, clear: clear });
  return side;
}

var _clear = () => {
  onclear.forEach((c) => { c(); })
  clear(0);
};
var clear = (lvl: number) => {
  if (!menus.length) return;
  for (var i = lvl; i < menus.length; ++i) {
    var m = menus[i];
    $(m.menu).remove();
    if (m.clear)
      m.clear();
  }
  if (menus.length > lvl)
    menus.length = lvl;
};
var keydown = (e) => {
  if (!menus.length) return;
  if (!/(38|40|27|32)/.test(e.which)) return;
  e.preventDefault();
  e.stopPropagation();
  _clear();
};
document.addEventListener('contextmenu', _clear, true);
document.addEventListener('click', _clear, true);
window.addEventListener('blur', _clear, false);
document.addEventListener('keydown', keydown, true);

class Menu {
  nativeMenu;
  domMenu: HTMLElement;
  lastSide: string;

  constructor(menu: MenuItemOptions[], allowBindings: boolean, allowNative = true) {
    if (isNative() && allowNative) {
      this.nativeMenu = new nativeMenu();
      menu.forEach((opts) => {
        this.nativeMenu.append(this._buildNativeMenuItem(opts, allowBindings));
      });
    }
    else {
      this.lastSide = "right";
      this.domMenu = document.createElement('ul');
      menu.forEach((opts) => {
        this._buildDomMenuItem(opts, allowBindings, this.domMenu, 0);
      });
    }
  }

  _buildDomKeyString(keyBind) {
    var bind = keyBind[useragent.isMac ? "mac" : "win"];
    if (bind) {
      bind = bind
        .replace(/-/g, ' ')
        .replace(/Command/g, '⌘')
        .replace(/Shift/g, '⇧')
        .replace(/Alt/g, '⌥');
    }
    return bind;
  }
  _buildDomMenuItem(opts: MenuItemOptions, allowBindings: boolean, parent: HTMLElement, level : number) {
    var dropdown, name, subMenu, subItems;
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
      if (cmd) {
        if (opts.role) {
          cmd.native = true;
          opts.click = () => { alert("TODO: this action is only available via shortcuts"); };
        }
        else {
          opts.click = () => { globals.ide.exec(cmd); };
        }
        if (!opts.bindKey)
          opts.bindKey = cmd.bindKey;
      }
    }
    if (opts.bindKey) {
      var shrt = document.createElement('span');
      shrt.className = "pull-right";
      shrt.textContent = this._buildDomKeyString(opts.bindKey);
      name.appendChild(shrt);
    }
    if (opts.click)
      name.addEventListener('click', opts.click, false);

    var subs =  [];
    if (opts.submenu)
      subs = (typeof opts.submenu === "function" ? (<any>opts.submenu)() : opts.submenu) || [];
    this._buildDomMenuItemSubs(dropdown, subs, allowBindings, level);
    return dropdown;
  }

  _buildDomSubmenu(subs: MenuItemOptions[], allowBindings, level: number) {
    var subMenu = document.createElement("ul");
    subMenu.className = "dropdown-menu";
    for (var sub of subs) {
      this._buildDomMenuItem(sub, allowBindings, subMenu, level + 1);
    }
    return subMenu;
  }

  _pop(dropdown: HTMLElement, subs: MenuItemOptions[], allowBindings, level: number) {
    if (!subs || !subs.length) return;
    var subMenu = this._buildDomSubmenu(subs, allowBindings, level);
    clear(level + 1);
    var r = dropdown.getBoundingClientRect();
    $(dropdown).addClass('open');
    this.lastSide = popup(subMenu, r, level == 0 ? "right" : this.lastSide, () => {
      $(dropdown).removeClass('open');
    });
  }

  _buildDomMenuItemSubs(dropdown: HTMLElement, subs: MenuItemOptions[], allowBindings, level: number) {
    if (subs.length > 0)
      $(dropdown).prepend('<i class="fa fa-fw fa-lg fa-caret-right dropdown-caret"></i>');
    var hover = false;
    dropdown.addEventListener('mouseover', () => {
      if (hover) return;
      hover = true;
      this._pop(dropdown, subs, allowBindings, level);
    }, false);
    dropdown.addEventListener('mouseleave', () => {
      hover = false;
    }, false);
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
        cmd.native = true;
        opts.bindKey = cmd.bindKey;
        if (!opts.role)
          opts.click = () => { globals.ide.exec(cmd); };
      }
    }
    if (allowBindings && opts.bindKey)
      native.accelerator = this._buildNativeKeyBind(opts.bindKey);
    var subs =  [];
    if (opts.submenu)
      subs = (typeof opts.submenu === "function" ? (<any>opts.submenu)() : opts.submenu) || [];
    if (subs.length) {
      native.submenu = subs.map((opts) => {
        return this._buildNativeMenuItem(opts, allowBindings);
      });
    }
    return native;
  }
  _buildNativeMenuItem(opts: MenuItemOptions, allowBindings: boolean) {
    return new nativeMenuItem(this._buildNativeMenuItemOpts(opts, allowBindings));
  }
}

export class TitleMenu extends Menu {
  commands;
  keyBinding;
  open: boolean;

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
    var exec = this.commands.exec;
    this.commands.exec = function(command, editor, args) {
      if (command.native)
        return false;
      return exec.apply(this, arguments);
    };
    this.commands.on("exec", (e) => { return ide.startOperation(e); });
    this.open = false;
    super(menu, true);
    if (this.nativeMenu) {
      this.nativeMenu.append(new nativeMenuItem({ label: 'Dev', submenu: [ {
        label: 'Reload',
        accelerator: 'CmdOrCtrl+R',
        click: function() { remote.getCurrentWindow().reload(); }
      },{
        label: 'Dev Tools',
        accelerator: 'CmdOrCtrl+Alt+I',
        click: function() { remote.getCurrentWindow().webContents.openDevTools(); }
      }]}));
      nativeMenu.setApplicationMenu(this.nativeMenu);
    }
    else {
      this.domMenu.className = "nav menu-title";
      nonNativeCb(this.domMenu);
    }
  }

  _pop(dropdown: HTMLElement, subs: MenuItemOptions[], allowBindings, level: number) {
    if (!subs || !subs.length) return;
    var subMenu = this._buildDomSubmenu(subs, allowBindings, level);
    clear(level);
    var r = dropdown.getBoundingClientRect();
    $(dropdown).addClass('open');
    popup(subMenu, r, level == 0 ? 'bottom' : 'right', () => {
      $(dropdown).removeClass('open');
    });
  }

  _buildDomMenuItemSubs(dropdown: HTMLElement, subs: MenuItemOptions[], allowBindings, level: number) {
    if (level == 0) {
      dropdown.addEventListener('click', (e) => {
        if (this.open) return;
        this.open = true;
        var c = () => {
          this.open = false;
          onclear.delete(c);
        };
        onclear.add(c)
        this._pop(dropdown, subs, allowBindings, level);
        e.preventDefault();
        dropdown.blur();
      }, false);
      var hover = false;
      dropdown.addEventListener('mouseover', () => {
        if (hover) return;
        hover = true;
        if (this.open)
          this._pop(dropdown, subs, allowBindings, level);
      }, false);
      dropdown.addEventListener('mouseleave', () => {
        hover = false;
      }, false);
    }
    else {
      super._buildDomMenuItemSubs(dropdown, subs, allowBindings, level);
    }
  }

  _signal() {}

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
      popup(this.domMenu, { top:y, bottom:y, height:0, right: x, left:x, width: 0 }, "right");
    }
    else {
      console.log(this.nativeMenu);
      this.nativeMenu.popup(remote.getCurrentWindow(), x, y);
    }
  }
}

export class Dropdown extends Menu {
  constructor(menu: MenuItemOptions[]) {
    super(menu, false, false);
    this.domMenu.className += "dropdown-menu menu-contextmenu";
  }

  showRelativeToElement(element: HTMLElement, side = "right") {
    popup(this.domMenu, element.getBoundingClientRect(), side);
  }
}

export var applicationMenu: TitleMenu = null;

export function bindContextMenuTo(el: HTMLElement, cb: () => MenuItemOptions[]) {
  el.addEventListener("contextmenu", createContextMenuEvent(cb), true);
}

export function createContextMenuEvent(cb: () => MenuItemOptions[]) {
  return function(event: MouseEvent) {
    event.preventDefault();
    var opts = cb();
    if (!opts || !opts.length) return;
    var menu = new ContextMenu(opts);
    menu.popup(event.clientX, event.clientY);
  };
}
