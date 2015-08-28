/// <reference path="../../typings/browser.d.ts" />
"use strict";
import View = require('./View');


export enum Orientation {
  VERTICAL,
  HORIZONTAL
}

type LayoutItem = {
  container: HTMLElement;
  view: View;
  size: number;
};

export interface SerializedBoxLayout extends View.SerializedView {
  orientation: string;
  items: View.SerializedView[];
}

export default class BoxLayout extends  View {
  static Orientation = Orientation;
  static View = View;

  private _items: LayoutItem[];
  _userCanResize: boolean;
  _orientation: Orientation;

  constructor(options: { userCanResize?: boolean, orientation?: Orientation } = {}) {
    super();
    this._items= [];
    this._userCanResize= typeof options.userCanResize === "boolean" ? options.userCanResize : false;
    this._orientation= typeof options.orientation == "number" ? options.orientation : Orientation.HORIZONTAL;

    this.el.className = "boxlayout";
  }

  getChildViews() : View[] {
    return this._items.map(function(item: LayoutItem) { return item.view; });
  }

  get orientation(): Orientation {
    return this._orientation;
  }
  set orientation(orientation: Orientation) {
    this._orientation = orientation;
    this.render();
  }

  get userCanResize(): boolean {
    return this._userCanResize;
  }
  set userCanResize(userCanResize: boolean) {
    this._userCanResize = userCanResize;
    this.render();
  }

  get count() {
    return this._items.length;
  }

  appendView(view: View, size: number) {
    this.insertView(view, size, this._items.length);
  }
  insertView(view: View, size: number, at: number) {
    if (at < 0 || at > this._items.length) throw  "'at' is out of bounds [0, " + this._items.length + "]";
    var item = {view: view, size:0, container: document.createElement('div') };
    this._items.splice(at, 0, item);
    this.rescaleItem(at, size);
  }
  replaceView(oldView: View, newView: View) {
    for(var item of this._items) {
      if (item.view === oldView) {
        item.view = newView;
        this.render();
        break;
      }
    }
  }
  removeView(view) {
    var idx = this._items.findIndex((item) => {
      return item.view === view;
    });
    if (idx != -1) {
      this.removePart(idx);
    }
  }

  removePart(at: number) {
    if (at < 0 || at >= this._items.length) throw  "'at' is out of bounds [0, " + this._items.length + "[";
    this.rescaleItem(at, 0);
    this._items.splice(at, 1);
    this.render();
  }

  movePart(from: number, to: number) {
    if (from < 0 || from >= this._items.length) throw  "'from' is out of bounds [0, " + this._items.length + "[";
    if (to < 0 || to >= this._items.length) throw  "'to' is out of bounds [0, " + this._items.length + "[";

    var tmp = this._items[from];
    this._items[from] = this._items[to];
    this._items[to] = tmp;
    this.render();
  }

  rescaleItem(at: number, size: number) {
    if (at < 0 || at >= this._items.length) throw  "'at' is out of bounds [0, " + this._items.length + "[";
    if (size < 0 || size > 1) throw "'size' is out of bounds [0.0, 1.0]";
    var scale = (1.0 - size) / (1.0 - this._items[at].size);
    for (var item of this._items) {
      item.size *= scale;
    }
    this._items[at].size = size;
    this.render();
  }

  rescaleSep(at: number, size: number) {
    if (at < 0 || at >= this._items.length - 1) throw  "'at' is out of bounds [0, " + (this._items.length - 1) + "[";
    if (size < 0 || size > 1) throw "'size' is out of bounds [0.0, 1.0]";
    this._items[at + 1].size = this._items[at + 1].size + this._items[at].size - size;
    this._items[at].size = size;
    this.render();
  }

  render() {
    var domItem: HTMLElement, sep: HTMLElement, left: number, right: number, propLeft: string, propRight: string;

    if (this._orientation == Orientation.HORIZONTAL) {
      propLeft= "left";
      propRight= "right";
    }
    else {
      propLeft= "top";
      propRight= "bottom";
    }

    left= 0;
    this._items.forEach((item: LayoutItem) => {
      if (item.container.parentNode)
        item.container.parentNode.removeChild(item.container);
    });

    this.el.innerHTML = "";
    this.$el.toggleClass("boxlayout-canresize", this._userCanResize);
    this.$el.toggleClass("boxlayout-horizontal", this._orientation == Orientation.HORIZONTAL);
    this.$el.toggleClass("boxlayout-vertical", this._orientation == Orientation.VERTICAL);
    this._items.forEach((item: LayoutItem, i: number) => {
      right = 1.0 - left - item.size;

      if (i > 0 && this._userCanResize) {
        domItem = document.createElement('div');
        domItem.className= "boxlayout-separator";
        domItem.style[propLeft] = (left * 100) + '%';
        sep = document.createElement('div');
        sep.addEventListener("mousedown", (event: MouseEvent) => { this._startMovingSeparator(event, i - 1) });
        domItem.appendChild(sep);
        this.el.appendChild(domItem);
      }

      domItem = document.createElement('div');
      domItem.className= "boxlayout-item";
      domItem.style[propLeft] = (left * 100) + '%';
      domItem.style[propRight] = (right * 100) + '%';
      domItem.appendChild(item.container);
      this.el.appendChild(domItem);
      item.container.appendChild(item.view.el);
      item.view.resize();

      left += item.size;
    });
  }

  private _startMovingSeparator(event: MouseEvent, i: number): void {
    if (event.button === 0) {
      var mvfn, upfn;
      var size = this.orientation === Orientation.HORIZONTAL ? this.el.clientWidth : this.el.clientHeight;
      var orsize = this._items[i].size;
      var pos = this.orientation === Orientation.HORIZONTAL ? event.screenX : event.screenY;
      var moved = (event:MouseEvent) => {
        var newpos = this.orientation === Orientation.HORIZONTAL ? event.screenX : event.screenY;
        var diff = (newpos - pos) / size;
        this.rescaleSep(i, orsize + diff);
        window.getSelection().removeAllRanges();
      };
      document.addEventListener("mousemove", mvfn = function (event:MouseEvent) {
        moved(event);
      }, true);
      document.addEventListener("mouseup", upfn = function (event:MouseEvent) {
        if (event.button === 0) {
          moved(event);
          document.removeEventListener("mousemove", mvfn, true);
          document.removeEventListener("mouseup", upfn, true);
        }
      }, true);
    }
  }

  decode(s : SerializedBoxLayout) {
    this.orientation = Orientation[s.orientation];
    // s.type === (<any>this.constructor).name
  }
  encode() : SerializedBoxLayout {
    var r = <SerializedBoxLayout>super.encode();
    r.orientation = Orientation[this.orientation];
    r.items = this._items.map((item) => {
      return item.view.encode();
    });
    return r;
  }
}
