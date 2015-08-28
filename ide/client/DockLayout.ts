/// <reference path="../../typings/browser.d.ts" />
"use strict";
import View = require('./View');
import ContentView = require('./ContentView');
import {default as TabLayout, TabItem} from "TabLayout";
import BoxLayout from "BoxLayout";

var orientations = [
  BoxLayout.Orientation.VERTICAL, // top
  BoxLayout.Orientation.HORIZONTAL,  // right
  BoxLayout.Orientation.VERTICAL,  // bottom
  BoxLayout.Orientation.HORIZONTAL // left
];
var isAppend = [false, true, true, false];


function reduceByPourcent(o: ClientRect, pourcent: number) {
  return {
    top: o.top + o.height * pourcent ,
    right: o.right - o.width * pourcent,
    bottom: o.bottom - o.height * pourcent,
    left: o.left + o.width * pourcent,
    width: o.width * (1 - pourcent * 2),
    height: o.height * (1 - pourcent * 2),
  };
}
function reduceByPx(o: ClientRect, px: number) {
  return {
    top: o.top + px ,
    right: o.right - px,
    bottom: o.bottom - px,
    left: o.left + px,
    width: o.width - px * 2 ,
    height: o.height - px * 2,
  };
}
function removeOffset(o: ClientRect, ro: ClientRect) {
  return {
    width: o.width,
    height: o.height,
    left: o.left - ro.left,
    top: o.top - ro.top,
    right: o.right - ro.left,
    bottom: o.bottom - ro.top
  }
}

class DockLayout extends View implements DockLayout.DockParentView {
  _items: DockLayout.DockItem[];
  _root: DockLayout.DockTabLayout | DockLayout.DockBoxLayout;
  _main: DockLayout.DockTabLayout;

  constructor() {
    super();

    this.el.className = "docklayout";
    this._main = new DockLayout.DockTabLayout(this);
    this._main.canMinimize = false;
    this._main.canRemove = false;
    this._main.appendTo(this.el);
    this._root = this._main;
  }

  root() {
    return this;
  }

  removeView(view) {
  }

  get main() : DockLayout.DockTabLayout {
    return this._main;
  }

  loadLayout(layout) {

  }

  exportLayout() {

  }

  getChildViews() : View[] {
    return [this._root];
  }

  appendViewTo(view: ContentView, position: DockLayout.Position) {
    if (position === DockLayout.Position.MIDDLE) {
      this.main.appendViewTo(view, position);
    }
    else if (this._root instanceof DockLayout.DockTabLayout) {
      (<DockLayout.DockTabLayout>this._root).appendViewTo(view, position);
    }
    else {
      var orientation = orientations[position];
      var root = (<DockLayout.DockBoxLayout>this._root);
      if (root.orientation !== orientation) {
        var parent = new DockLayout.DockBoxLayout(root, { orientation: orientation, userCanResize: true });
        this.replaceView(root, parent);
        parent.appendView(root, 1.0);
        root = parent;
      }
      var tab = new DockLayout.DockTabLayout(root);
      tab.appendView(view);
      if (isAppend[position])
        root.appendView(tab, 0.25);
      else
        root.insertView(tab, 0.25, 0);
    }
   }

  replaceView(oldView: DockLayout.DockTabLayout | DockLayout.DockBoxLayout, newView: DockLayout.DockTabLayout | DockLayout.DockBoxLayout) {
    if (this._root !== oldView) throw "Dock layout is corrupted";
    this._root = newView;
    this._root.appendTo(this.el);
    this.render();
  }

  _dockPlaces;
  showDockPlaces() {
    var createPolygon = (tl_x,tl_y, tr_x, tr_y, br_x, br_y, bl_x, bl_y, tab, pos, cls?: string) => {
      var polygon = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
      polygon.setAttribute("points", tl_x+","+tl_y+" "+tr_x+","+tr_y+" "+br_x+","+ br_y+" "+bl_x+","+bl_y);
      svg.appendChild(polygon);
      if (cls)
        polygon.setAttribute("class", cls);
      (<any>polygon)._docklayout = { root: this, tab:tab, pos:pos };
      return polygon;
    };

    var svg = this._dockPlaces = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "docklayout-overlay");
    svg.setAttributeNS("http://www.w3.org/2000/xmlns/", "xmlns:xlink", "http://www.w3.org/1999/xlink");
    this.el.appendChild(svg);
    var offset = this.el.getBoundingClientRect();
    var traverse = function(what : View) {
      if (what instanceof DockLayout.DockTabLayout) {
        var rect = what._elContent.getBoundingClientRect();
        var o = removeOffset(rect, offset);
        var m = reduceByPourcent(o, 0.25);

        createPolygon(m.left, m.top, m.right, m.top, m.right, m.bottom, m.left, m.bottom, what, DockLayout.Position.MIDDLE);
        createPolygon(o.left, o.top, o.right, o.top, m.right, m.top, m.left, m.top, what, DockLayout.Position.TOP);
        createPolygon(o.right, o.top, o.right, o.bottom, m.right, m.bottom, m.right, m.top, what, DockLayout.Position.RIGHT);
        createPolygon(o.left, o.bottom, o.right, o.bottom, m.right, m.bottom, m.left, m.bottom, what, DockLayout.Position.BOTTOM);
        createPolygon(o.left, o.top, o.left, o.bottom, m.left, m.bottom, m.left, m.top, what, DockLayout.Position.LEFT);
      }
      else if (what instanceof DockLayout.DockBoxLayout) {
        for(var view of what.getChildViews()) {
          traverse(view);
        }
      }
    };
    traverse(this._root);
    var ro = removeOffset(offset, offset);
    var m = reduceByPx(ro, 20);

    createPolygon(ro.left, ro.top, ro.right, ro.top, m.right, m.top, m.left, m.top, this, DockLayout.Position.TOP, "docklayout-overlay-root");
    createPolygon(ro.right, ro.top, ro.right, ro.bottom, m.right, m.bottom, m.right, m.top, this, DockLayout.Position.RIGHT, "docklayout-overlay-root");
    createPolygon(ro.left, ro.bottom, ro.right, ro.bottom, m.right, m.bottom, m.left, m.bottom, this, DockLayout.Position.BOTTOM, "docklayout-overlay-root");
    createPolygon(ro.left, ro.top, ro.left, ro.bottom, m.left, m.bottom, m.left, m.top, this, DockLayout.Position.LEFT, "docklayout-overlay-root");
  }
  hideDockPlaces() {
    this._dockPlaces.parentNode.removeChild(this._dockPlaces);
  }

}


module DockLayout {
  export enum Position {
    TOP,
    RIGHT,
    BOTTOM,
    LEFT,
    MIDDLE
  }
  export type DockItem = {
    view: View;
  };

  export type SerializedLayout = {
    type: string;
    [s: string]: any;
  }

  export interface DockParentView {
    root(): DockLayout;
    replaceView(oldView:DockTabLayout | DockBoxLayout, newView:DockTabLayout | DockBoxLayout);
    removeView(oldView:DockTabLayout | DockBoxLayout)
  }

  export class DockBoxLayout extends BoxLayout implements DockParentView {
    root() {
      return this.parent.root();
    }

    constructor(public parent: DockParentView, options) {
      super(options);
    }

    appendView(view:DockTabLayout | DockBoxLayout, size:number) {
      super.appendView(view, size);
    }

    insertView(view:DockTabLayout | DockBoxLayout, size: number, at: number) {
      super.insertView(view, size, at);
    }

    removePart(at: number) {
      super.removePart(at);
      if (this.count == 0) {
        this.parent.removeView(this);
      }
    }
  }

  export class DockTabLayout extends TabLayout {
    canRemove:boolean = true;
    canMinimize:boolean = true;

    constructor(public parent:DockParentView) {
      super();
    }

    root() {
      return this.parent.root();
    }

    appendViewTo(view:ContentView, position:Position) {
      if (position === Position.MIDDLE) {
        this.appendView(view);
      }
      else {
        var orientation = orientations[position];
        if (this.parent instanceof DockLayout || (<DockBoxLayout>this.parent).orientation !== orientation) {
          var parent = new DockBoxLayout(this.parent, {orientation: orientation, userCanResize: true});
          this.parent.replaceView(this, parent);
          this.parent = parent;
          parent.appendView(this, 1.0);
        }
        var tab = new DockTabLayout(this.parent);
        tab.appendView(view);
        if (isAppend[position])
          (<DockBoxLayout>this.parent).appendView(tab, 0.25);
        else
          (<DockBoxLayout>this.parent).insertView(tab, 0.25, 0);
      }
    }

    removeTab(at: number) {
      super.removeTab(at);
      if (this._tabs.length == 0 && this.canRemove) {
        this.parent.removeView(this);
      }
    }
    renderTabs() {
      super.renderTabs();
      // TODO: minimize to bar
    }

    private _startMovingDockItem(event: MouseEvent, idx: number): void {
      if (event.button === 0) {
        var upfn, mvfn;
        var root = this.root();
        var started = false;
        var sx = event.screenX, sy = event.screenY;
        document.addEventListener("mousemove", mvfn = (event:MouseEvent) => {
          if (!started) {
            var x = event.screenX, y = event.screenY;
            var dx = sx - x, dy = sy - y;
            if (dx * dx + dy * dy > 10) {
              root.showDockPlaces();
              started= true;
            }
          }
        }, true);
        document.addEventListener("mouseup", upfn = (event:MouseEvent) => {
          if (event.button === 0) {
            if (started) {
              var el:any = document.elementFromPoint(event.clientX, event.clientY);
              var data = el._docklayout;
              if (data && data.root == root) {
                var view = this._tabs[idx].view;
                this.removeTab(idx);
                data.tab.appendViewTo(view, data.pos);
              }
              root.hideDockPlaces();
            }
            document.removeEventListener("mousemove", mvfn, true);
            document.removeEventListener("mouseup", upfn, true);
          }
        }, true);
      }
    }

    renderTab(item:TabItem, idx:number) {
      var domItem = super.renderTab(item, idx);
      domItem.addEventListener("mousedown", (event: MouseEvent) => {
        this._startMovingDockItem(event, idx);
      });
      return domItem;
    }

  }
}

export = DockLayout;
