import { EventEmitter } from "../core/events";
import globals = require('../core/globals');

interface ViewHTMLElement extends HTMLElement {
  _view: View;
}

class View extends EventEmitter {
  el: ViewHTMLElement;
  $el: JQuery;

  static findViewFromDOMElement(parentElement: HTMLElement) {
    var ret = null;
    while(ret === null && parentElement && parentElement !== document.body) {
      if ((<any>parentElement)._view instanceof View)
        ret = (<ViewHTMLElement>parentElement)._view;
      parentElement = parentElement.parentElement;
    }
    return ret;
  }

  constructor(tagName: string | HTMLElement = "div") {
    super();
    if (tagName instanceof HTMLElement)
      this.el = <ViewHTMLElement>tagName;
    else
      this.el = <ViewHTMLElement>document.createElement(<string>tagName);
    this.el._view = this;
    this.$el = jQuery(this.el);
  }

  focus() {

  }

  detach() {
    var parentNode = this.el.parentNode;
    if (parentNode)
      parentNode.removeChild(this.el);
  }

  destroy() {
    this.getChildViews().forEach(function(c) { c.destroy() });
    this._signal('destroy', null);
    if ((<any>this)._eventRegistry)
      (<any>this)._eventRegistry = {};
    this.detach();
    $(this.el).empty();
  }

  appendTo(el:HTMLElement):void {
    el.appendChild(this.el);
    this.resize();
  }

  getChildViews() : View[] {
    return [];
  }

  getParentView() : View {
    return View.findViewFromDOMElement(this.el.parentElement);
  }

  /** update the view */
  render() {

  }

  /** resize the view (after a resize event or when the DOM Changes) */
  resize() {
    for(var view of this.getChildViews()) {
      view.resize();
    }
  }

  /** force this view to render itself and all its childens
   *  ie. translation change event */
  propagateRender() {
    this.render();
    for(var view of this.getChildViews()) {
      view.propagateRender();
    }
  }

  protected createElement() {
    return document.createElement('div');
  }

  static placeholder() : View {
    return new View();
  }
}

export = View;
