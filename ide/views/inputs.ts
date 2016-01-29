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
