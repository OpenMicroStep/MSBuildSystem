import View = require('./View');
import globals = require('../core/globals');

abstract class ContentView extends View {
  titleEl : HTMLElement;
  _visible: boolean;

  static registered = new Map<string, (data)=> ContentView>();
  static register(cls, type: string, deserialize?: (data: any) => ContentView) {
    deserialize = deserialize || function(data) { return new cls(data); };
    cls.prototype.serialize = function() { return {
      type: type,
      data: this.data()
    };};
    ContentView.registered.set(type, deserialize);
  }
  static deserialize(data: { type: string, data }) {
    var cstor = ContentView.registered.get(data.type);
    return cstor ? cstor(data.data || {}) : null;
  }

  constructor(tagName: string = "div", titleTagName: string = "div", canBeIDECurrentView = false) {
    super(tagName);
    this.titleEl = document.createElement(titleTagName);
    this._visible = false;
    if (canBeIDECurrentView) {
      this.el.addEventListener('click', (event) => {
        globals.ide.setCurrentView(this);
        return false;
      }, false);
    }
  }

  isViewFor(...args: any[]) {
    return false;
  }

  isVisible() {
    return this._visible;
  }

  show() {
    this._visible = true;
    this.resize();
  }

  hide() {
    this._visible = false;
    this.detach();
  }

  destroy() {
    super.destroy();
    $(this.titleEl).remove();
    if (globals.ide._focus === this)
      globals.ide.setCurrentView(null);
  }

  focus() {
    globals.ide.setCurrentView(this);
  }

  appendTitleTo(el:HTMLElement):void {
    el.appendChild(this.titleEl);
    this.resizeTitle();
  }

  tryDoAction(p, command): boolean {
    console.log("will do", command);
    return false;
  }

  resizeTitle() {

  }

  renderTitle() {

  }

  dragndrop() : { text?: string, data?: any, file?: string } {
    return { data: this.serialize() }
  }
  data(): any { return null; }

  extendsContextMenu(items, tabLayout, idx) {
    if (this.duplicate) {
      items.push({
        label: "Duplicate view",
        click: () => {
          tabLayout.insertView(this.duplicate(), idx + 1, false);
        }
      });
    }
  }

  // Optionals
  serialize:() => { type: string, data: any };
  duplicate: () => ContentView;
}

module ContentView {
  export class Simple extends ContentView {
    view: View;
    constructor(title: string, view: View) {
      super();
      this.titleEl.textContent = title;
      this.view = view;
      this.el.appendChild(this.view.el);
    }
    getChildViews() : View[] {
      return [this.view];
    }
  }
}

export = ContentView;
