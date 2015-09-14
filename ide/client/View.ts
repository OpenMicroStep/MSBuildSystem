/// <reference path="../../typings/browser.d.ts" />
import { EventEmitter } from "./events";

class View extends EventEmitter {
  el: HTMLElement;
  $el: JQuery;

  constructor(tagName: string = "div") {
    super();
    this.el = document.createElement(tagName);
    this.$el = jQuery(this.el);
  }

  destroy() {
    var parentNode = this.el.parentNode;
    if (parentNode)
      parentNode.removeChild(this.el);
  }

  appendTo(el:HTMLElement):void {
    el.appendChild(this.el);
    this.resize();
  }

  getChildViews() : View[] {
    return [];
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
