import View = require('./View');
import menu = require('../core/menu');

export abstract class Input<T> extends View {
  constructor(tagName?: string | HTMLElement) {
    super(tagName)
  }

  abstract setValue(T: boolean) ;
  abstract value(): T;

  disabled() : boolean {
    return this.$el.hasClass('disabled');
  }
  setDisabled(val : boolean) {
    this.$el.toggleClass('disabled', !!val);
  }
}

export class CheckboxInput extends Input<boolean> {
  constructor() {
    super();
    this.el.className = "form-control form-control-checkbox";
    this.el.addEventListener('click', this.onclick.bind(this));
  }

  onclick(evt) {
    if (!this.disabled())
      this.setValue(!this.value());
  }

  value() {
    return this.$el.hasClass('checked');
  }
  setValue(val) {
    var checked = !!val;
    if (checked !== this.value()) {
      this.$el.toggleClass('checked', checked);
      this._emit('change', { value: checked })
    }
  }
}

export class SelectInput extends Input<string> {
  _value: string;
  constructor(public list: {label: string, value: string}[]) {
    super();
    this.el.className = "btn btn-secondary dropdown-toggle";
    this.el.addEventListener('click', this.onclick.bind(this));
  }

  onclick(evt) {
    if (this.disabled()) return;
    var dropdown = new menu.Dropdown(this.list.map((item) => {
      return {
        label: item.label,
        click: () => {
          this.el.textContent = item.label;
          this.setValue(item.value);
        } };
    }));
    dropdown.showRelativeToElement(this.el, "bottom");
  }

  value() {
    return this._value;
  }
  setValue(val) {
    if (val !== this._value) {
      var v = this.list.find((i) => { return i.value === val; });
      if (v !== undefined) {
        this._value = v.value;
        this.el.textContent = v.label;
        this._emit('change', { value: val });
      }
    }
  }
}

export class TextInput extends Input<string> {
  constructor() {
    super('input');
    this.el.className = "form-control";
  }

  value() {
    return (<any>this.el).value;
  }
  setValue(val) {
    if (val !== this.value()) {
      (<any>this.el).value = val;
      this._emit('change', { value: val });
    }
  }
}

export class ChecklistInput extends Input<string[]> {
  list: { label: string, value: string, chk: CheckboxInput }[];
  silent: number;
  constructor(list: {label: string, value: string}[]) {
    super('div');
    this.silent = 0;
    this.list = list.map((e) => {
      var chk = new CheckboxInput();
      var item: any = typeof e === "string" ? {label: e, value: e, chk: chk} : {label: e.label, value: e.value, chk: chk};
      var el = document.createElement('div');
      el.className = "checklist-item";
      chk.on('change', this.onchecked.bind(this));
      el.appendChild(chk.el);
      var lbl = document.createElement("span");
      lbl.textContent = item.label;
      el.appendChild(lbl);
      this.el.appendChild(el);
      return item;
    });
  }

  onchecked() {
    if (this.silent === 0)
      this._emit('change', { value: this.value() });
    else
      this.silent = 2;
  }

  value() {
    var val = [];
    this.list.forEach((item, i) => {
      if (item.chk.value())
        val.push(item.value);
    });
    return val;
  }

  setValue(val) {
    if (Array.isArray(val)) {
      this.silent = 1;
      this.list.forEach((item, idx) => {
        item.chk.setValue(val.indexOf(item.value) !== -1);
      });
      if (this.silent === 2)
        this._emit('change', { value: this.value() });
      this.silent = 0;
    }
  }
}
