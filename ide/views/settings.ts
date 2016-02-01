import core = require('../core');
import inputs = require('./inputs');
import CheckboxView = require('./CheckboxView');

interface IInput {
  new (opts: any): inputs.Input<any>;
}

export interface Definition {
  label?: string;
  type?: IInput;
  path?: string[];
  options?: any;
  mapToInput?: (value: any) => any;
  mapFromInput?: (value: any) => any;
  default?: any;
  subs?: Definition[];
}

export class SettingsDefinition {
  constructor(public basepath: string[], public defs: Definition[]) { }
  createInterface(parent: HTMLElement) {
    this._adddefs(this.defs, parent, 0);
  }

  _adddefs(defs: Definition[], parent: HTMLElement, level: number) {
    if (!defs) return;
    defs.forEach((def) => {
      this._adddef(def, parent, level);
    });
  }

  _adddef(def: Definition, parent: HTMLElement, level: number) {
    var h1: HTMLElement, c: HTMLElement, label: HTMLElement, input: HTMLElement;
    if (!def.type) {
      h1 = document.createElement('h3');
      h1.className = "settings-title row";
      h1.textContent = def.label;
      parent.appendChild(h1);
      this._adddefs(def.subs, parent, level + 1);
    }
    else {
      c = document.createElement('div');
      c.className = "form-group row";
      if (def.label) {
        label = document.createElement('label');
        label.className = "col-sm-4 form-control-label";
        label.textContent = def.label;
        c.appendChild(label);
      }
      input = document.createElement('div');
      input.className = def.label ? "col-sm-8" : "col-sm-8 col-sm-offset-4";
      c.appendChild(input);
      parent.appendChild(c);
      var i = new def.type(def.options);var v = this._value(def, false);
      if (def.mapToInput)
        v = def.mapToInput(v);
      i.setValue(v);
      i.on('change', (e) => {
        if (def.mapFromInput)
          e.value = def.mapFromInput(e.value);
        core.globals.ide.session.set(this.basepath.concat(def.path), e.value);
      })
      input.appendChild(i.el);
    }
  }

  _value(def: Definition, reset) {
    var p = this.basepath.concat(def.path);
    var v = core.globals.ide.session.get(p, def.default);
    if (reset)
      core.globals.ide.session.set(p, def.default);
    return v;
  }

  fillWithDefaults(force: boolean = false) {
    this._fillWithDefaults(this.defs, force);
  }

  _fillWithDefaults(defs: Definition[], force) {
    if (!defs) return;
    defs.forEach((def) => {
      if (def.path && def.default !== undefined)
        this._value(def, force);
      if (def.subs)
        this._fillWithDefaults(def.subs, force);
    });
  }
}

export class SettingsView extends core.ContentView {
  constructor(public definition: SettingsDefinition) {
    super();
    this.el.className = "container-fluid";
    this.definition.createInterface(this.el);
  }

  isViewFor() {
    return true;
  }

  data() {
    return null;
  }
}
