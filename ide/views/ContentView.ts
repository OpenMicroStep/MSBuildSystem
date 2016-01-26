import View = require('./View');
import globals = require('../core/globals');

abstract class ContentView extends View {
  titleEl : HTMLElement;

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

  constructor(tagName: string = "div", titleTagName: string = "div") {
    super(tagName);
    this.titleEl = document.createElement(titleTagName);
    this.el.addEventListener('click', globals.ide.setCurrentView.bind(globals.ide, this));
  }

  isViewFor(...args: any[]) {
    return false;
  }

  destroy() {
    super.destroy();
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
  abstract data(): any;

  // Optionals
  serialize:() => { type: string, data: any };
  duplicate: () => ContentView;
}

export = ContentView;
