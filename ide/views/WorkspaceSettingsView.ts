/// <reference path="../../typings/browser.d.ts" />
"use strict";
import core = require('../core');
import Workspace = require('../client/Workspace');
import ContentView = require('../views/ContentView');
import CheckboxView = require('../views/CheckboxView');
type Graph = Workspace.Graph;

enum Type {
  Checkbox,
  Checklist
}

interface Definition {
  label?: string;
  type?: Type;
  path?: string[];
  list?: (string | {label: string, value: any, default?: any})[];
  default?: any;
  subs?: Definition[];
  private?: any;
}

interface InternalDefinition {
  type?: Type;
  path?: string[];
  list?: {label: string, value: any, default?: any}[];
  default?: any;
  subs: InternalDefinition[];
  private: any;
}

class WorkspaceSettingsView extends ContentView {
  workspace: Workspace;
  _defs: Definition[];
  _data: any;
  _save;
  $setdata;

  constructor(workspace: Workspace) {
    super();
    this.workspace = workspace;
    this.titleEl.textContent = workspace.name;

    this.el.className = "settings";
    this._data = {};
    this._save = null;
    this.setDefinition([
    {
      label: 'Variants',
      subs: [{
        type: Type.Checklist,
        default: true,
        path: ['variants'],
        list: ["debug", "release"]
      }]
    },
    {
      label: 'Environments',
      subs: [{
        type: Type.Checklist,
        default: true,
        path: ['environments'],
        list: workspace.environments.map(n => n.name)
      }]
    },
    {
      label: 'Targets',
      subs: [{
        type: Type.Checklist,
        default: true,
        path: ['targets'],
        list: workspace.targets.map(n => n.name)
      }]
    }
    ]);
    (new core.async.Async(null, [
      this.workspace.userData.bind(this.workspace),
      (p) => { this.setData(p.context.result); p.continue(); }
    ])).continue();
    this.workspace.on('userdata', this.$setdata = this.setData.bind(this));
  }

  destroy() {
    this.workspace.off('userdata', this.$setdata);
    super.destroy();
  }

  _adddefs(defs: Definition[], parent: HTMLElement, level: number) {
    if (!defs) return;
    defs.forEach((def) => {
      this._adddef(def, parent, level);
    })
  }

  _adddef(def: Definition, parent: HTMLElement, level: number) {
    var h1: HTMLElement, c: HTMLElement;
    switch(def.type) {
      case Type.Checklist:
        c = document.createElement('ul');
        var onchecked = () => {
          var value = [];
          def.private.forEach((chk, i) => {
            if (chk.checked) {
              var item = def.list[i];
              value.push(typeof item === "string" ? item : item.value);
            }
          });
          this.setValue(def.path, value);
        };
        def.private = def.list.map((e) => {
          var item: any = typeof e === "string" ? {label: e, value: e} : e;
          var el = document.createElement('li');
          var chk = new CheckboxView(item.label);
          if (item.default !== void 0)
            chk.checked = item.default;
          else if (def.default !== void 0)
            chk.checked = def.default;
          chk.on('checked', onchecked);
          el.appendChild(chk.el);
          c.appendChild(el);
          return chk;
        });
        parent.appendChild(c);
        break;

      default:
        h1 = document.createElement('div');
        h1.className = "settings-title";
        h1.textContent = def.label;
        c = document.createElement('div');
        parent.appendChild(c);
        c.appendChild(h1);
        this._adddefs(def.subs, c, level + 1);
        break;
    }
  }

  setDefinition(defs: Definition[]) {
    this._adddefs(defs, this.el, 1);
    this._defs = defs;
  }

  value(path: string[]) {
    var d = this._data;
    for(var i = 0, len = path.length; d !== void 0 && i < len; ++i)
      d = d[path[i]];
    return i == len ? d : undefined;
  }

  setValue(path: string[], value) {
    var d = this._data;
    for(var i = 0, len = path.length - 1; d !== void 0 && i < len; ++i)
      d = d[path[i]];
    d[path[i]] = value;
    this._willsave();
  }

  _willsave() {
    if (this._save)
      clearTimeout(this._save);
    this._save = setTimeout(() => {
      this._save = null;
      this.save();
    }, 1000);
  }

  save() {
    console.log("save", this._data);
    (new core.async.Async(null, [
      (p) => { this.workspace.setUserData(p, this._data); }
    ])).continue();
  }

  _applydef(def: Definition) {
    if (def.path) {
      var value = this.value(def.path);
      switch(def.type) {
        case Type.Checklist:
          value = Array.isArray(value) ? value : undefined;
          def.list.forEach((e: any, i) => {
            var item: any = typeof e === "string" ? {label: e, value: e} : e;
            var chk = def.private[i];
            if (value === undefined) {
              if (item.default !== void 0)
                chk.checked = item.default;
              else if (def.default !== void 0)
                chk.checked = def.default;
            }
            else {
              chk.checked = (<string[]>value).indexOf(item.value) !== -1;
            }
          });
          break;
      }
    }
    this._applydefs(def.subs);
  }
  _applydefs(defs: Definition[]) {
    if (!defs) return;
    defs.forEach((def) => { this._applydef(def); });
  }

  setData(d) {
    this._data = d;
    console.log("load", this._data);
    this._applydefs(this._defs);
    if (this._save) {
      clearTimeout(this._save);
      this._save = null;
    }
  }

  isViewFor(workspace) {
    return this.workspace === workspace;
  }
}

export = WorkspaceSettingsView;
