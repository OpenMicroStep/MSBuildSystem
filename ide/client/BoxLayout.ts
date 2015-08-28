/// <reference path="../../typings/browser.d.ts" />
"use strict";
import View = require('./View');


export enum Orientation {
  VERTICAL,
  HORIZONTAL
}

type LayoutItem = {
  view: View;
  size: number;
};

export interface SerializedBoxLayout extends View.SerializedView {
  orientation: string;
  items: View.SerializedView[];
}

/**
DOM structure:
 <div class="boxlayout [boxlayout-horizontal or boxlayout-vertical] [boxlayout-canresize]"> <!-- BoxLayout.el -->
   <div class="boxlayout-item" style="[left: x1%; right: x2%; or top: y1%; bottom: y2%;]">  <!-- BoxLayout._item[i].item -->
     <div>[[CONTENT #1]]</div>                                                              <!-- BoxLayout._item[i].container, BoxLayout._item[i].view.el -->
   </div>
   <div class="boxlayout-separator" style="[left:x1%; or top: y1%]">                        <!-- BoxLayout._separators[i] -->
     <div></div>
   </div>
   <div class="boxlayout-item" style="[left: x1%; right: x2%; or top: y1%; bottom: y2%;]">
     <div>[[CONTENT #2]]</div>
   </div>
 </div>
*/
export default class BoxLayout extends  View {
  static Orientation = Orientation;
  static View = View;

  _items: LayoutItem[];
  _userCanResize: boolean;
  _orientation: Orientation;

  constructor(options: { userCanResize?: boolean, orientation?: Orientation } = {}) {
    super();
    this._items= [];
    this.el.className = "boxlayout";
    this.userCanResize= typeof options.userCanResize === "boolean" ? options.userCanResize : false;
    this.orientation= typeof options.orientation == "number" ? options.orientation : Orientation.HORIZONTAL;
  }

  getChildViews() : View[] {
    return this._items.map(function(item: LayoutItem) { return item.view; });
  }

  get orientation(): Orientation {
    return this._orientation;
  }
  set orientation(orientation: Orientation) {
    this._orientation = orientation;
    this.$el.toggleClass("boxlayout-horizontal", this._orientation == Orientation.HORIZONTAL);
    this.$el.toggleClass("boxlayout-vertical", this._orientation == Orientation.VERTICAL);
    this.updateScales();
  }

  get userCanResize(): boolean {
    return this._userCanResize;
  }
  set userCanResize(userCanResize: boolean) {
    this._userCanResize = userCanResize;
    this.$el.toggleClass("boxlayout-canresize", this._userCanResize);
  }

  get count() {
    return this._items.length;
  }

  findView(view: View) : number {
    return this._items.findIndex((item) => {
      return item.view === view;
    });
  }
  appendView(view: View, size: number) {
    this.insertView(view, size, this._items.length);
  }
  insertView(view: View, size: number, at: number) {
    if (at < 0 || at > this._items.length) throw  "'at' is out of bounds [0, " + this._items.length + "]";

    // DOM
    if (this._items.length > 0) {
      var domSep = document.createElement('div');
      domSep.className= "boxlayout-separator";
      domSep.addEventListener("mousedown", (event: MouseEvent) => {
        var nodes = this.el.childNodes, sep = 0;
        for(var i = 1, len = nodes.length; i < len; i += 2) {
          if (nodes[i] == domSep) {
            this._startMovingSeparator(event, sep);
            break;
          }
          ++sep;
        }
      });
      domSep.appendChild(document.createElement("div"));
      this.el.insertBefore(domSep, this.el.childNodes[at > 0 ? at * 2 - 1 : 0]);
    }
    var domContainer = document.createElement('div');
    domContainer.appendChild(view.el);
    var domItem = document.createElement('div');
    domItem.className= "boxlayout-item";
    domItem.appendChild(domContainer);
    this.el.insertBefore(domItem, this.el.childNodes[at * 2]);

    // Items
    this._items.splice(at, 0, {view: view, size:0});

    // Sizing
    this.rescaleItem(at, size);
  }

  replaceView(oldView: View, newView: View) {
    var idx = this.findView(oldView);
    if (idx != -1) {
      this.replaceViewAt(idx, newView);
    }
  }
  replaceViewAt(at: number, newView: View) {
    if (at < 0 || at >= this._items.length) throw  "'at' is out of bounds [0, " + this._items.length + "[";
    this._items[at].view = newView;
    var domContainer = this.el.childNodes[at * 2].firstChild;
    domContainer.removeChild(domContainer.firstChild);
    domContainer.appendChild(newView.el);
  }

  removeView(view: View) {
    var idx = this.findView(view);
    if (idx != -1) {
      this.removePart(idx);
    }
  }
  removePart(at: number) {
    if (at < 0 || at >= this._items.length) throw  "'at' is out of bounds [0, " + this._items.length + "[";
    this.rescaleItem(at, 0);
    this.el.removeChild(this.el.childNodes[at * 2]); //< Remove item
    if (this._items.length > 1)
      this.el.removeChild(this.el.childNodes[at > 0 ? at * 2 - 1 : 0]); //< Remote separator
    this._items.splice(at, 1);
  }

  movePart(from: number, to: number) {
    if (from < 0 || from >= this._items.length) throw  "'from' is out of bounds [0, " + this._items.length + "[";
    if (to < 0 || to >= this._items.length) throw  "'to' is out of bounds [0, " + this._items.length + "[";

    var itemFrom = this._items[from];
    var itemTo = this._items[to];
    this._items[from] = itemTo;
    this._items[to] = itemFrom;
    this.el.childNodes[from * 2].firstChild.appendChild(itemTo.view.el);
    this.el.childNodes[to * 2].firstChild.appendChild(itemFrom.view.el);
    itemTo.view.resize();
    itemFrom.view.resize();
  }

  rescaleItem(at: number, size: number) {
    if (at < 0 || at >= this._items.length) throw  "'at' is out of bounds [0, " + this._items.length + "[";
    if (size < 0 || size > 1) throw "'size' is out of bounds [0.0, 1.0]";
    var scale = (1.0 - size) / (1.0 - this._items[at].size);
    for (var item of this._items) {
      item.size *= scale;
    }
    this._items[at].size = size;
    this.updateScales();
  }
  rescaleSep(at: number, size: number) {
    if (at < 0 || at >= this._items.length - 1) throw  "'at' is out of bounds [0, " + (this._items.length - 1) + "[";
    if (size < 0 || size > 1) throw "'size' is out of bounds [0.0, 1.0]";
    this._items[at + 1].size = this._items[at + 1].size + this._items[at].size - size;
    this._items[at].size = size;
    this.updateScales();
  }

  updateScales() {
    var propLeft: string, propRight: string;
    var left = 0, right: number;
    var itemIdx = 0, item: LayoutItem;
    var wasSep = true;

    if (this._orientation == Orientation.HORIZONTAL) {
      propLeft= "left";
      propRight= "right";
    }
    else {
      propLeft= "top";
      propRight= "bottom";
    }

    for(var domChild:HTMLElement = <HTMLElement>this.el.firstChild; domChild; domChild = <HTMLElement>domChild.nextSibling) {
      if (wasSep) { // domChild is an item
        item = this._items[itemIdx++];
        right = 1.0 - left - item.size;
        domChild.style[propLeft] = (left * 100) + '%';
        domChild.style[propRight] = (right * 100) + '%';
        item.view.resize();
        left += item.size;
      }
      else { // domChild is a separator
        domChild.style[propLeft] = (left * 100) + '%';
      }
      wasSep = !wasSep;
    }
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
