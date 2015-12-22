/// <reference path="../../typings/browser.d.ts" />
import { EventEmitter } from "./events";
import globals = require('./globals');

interface ViewHTMLElement extends HTMLElement {
  _view: View;
}

function parentView(parentElement: HTMLElement) {
}

class View extends EventEmitter {
  el: ViewHTMLElement;
  $el: JQuery;

  static findViewFromDOMElement(parentElement: Element) {
    var ret = null;
    while(ret === null && parentElement && parentElement !== document.body) {
      if ((<any>parentElement)._view instanceof View)
        ret = (<ViewHTMLElement>parentElement)._view;
      parentElement = parentElement.parentElement;
    }
    return ret;
  }
  constructor(tagName: string = "div") {
    super();
    this.el = <ViewHTMLElement>document.createElement(tagName);
    this.el._view = this;
    this.$el = jQuery(this.el);
  }

  destroy() {
    var parentNode = this.el.parentNode;
    if (parentNode)
      parentNode.removeChild(this.el);
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

  tryDoAction(command): boolean {
    console.log("will do", command);
    return false;
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

  decode(s : View.SerializedView) {
    // s.type === (<any>this.constructor).name
  }
  encode() : View.SerializedView {
    return { type: <string>(<any>this.constructor).name };
  }

  protected createElement() {
    return document.createElement('div');
  }

  static placeholder() : View {
    return new View();
  }
}

module View {
  export interface SerializedView {
    type: string;
  }
}

export = View;
