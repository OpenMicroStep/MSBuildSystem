import View = require('./View');

class CheckboxView extends View {
  $box;

  constructor(label?: string) {
    super();
    var box = label ? document.createElement('div') : this.el;
    this.$box = label ? $(box) : this.$el;
    box.className = "form-control form-control-checkbox";
    this.el.addEventListener('click', this.$onclick = this.onclick.bind(this));
    if (label) {
      this.el.className = "checkboxview";
      this.el.appendChild(box);
      var lbl = document.createElement('span');
      lbl.textContent = label;
      this.el.appendChild(lbl);
    }
  }

  private $onclick;
  private onclick(evt) {
    if (!this.disabled)
      this.checked = !this.checked;
  }

  get checked() {
    return this.$box.hasClass('checked');
  }
  set checked(val) {
    var checked = !!val;
    if (checked !== this.checked) {
      this.$box.toggleClass('checked', checked);
      this._emit('checked', checked)
    }
  }

  get disabled() {
    return this.$box.hasClass('disabled');
  }
  set disabled(val) {
    this.$box.toggleClass('disabled', !!val);
  }
}

export = CheckboxView;
