import View = require('./View');
import ContentView = require('./ContentView');
import TabLayout = require("./TabLayout");
import BoxLayout = require("./BoxLayout");
import dragndrop = require("../core/dragndrop");
import globals = require("../core/globals");
import async = require("../core/async");
import util = require("../core/util");
import Async = async.Async;

var orientations = [
  BoxLayout.Orientation.VERTICAL, // top
  BoxLayout.Orientation.HORIZONTAL,  // right
  BoxLayout.Orientation.VERTICAL,  // bottom
  BoxLayout.Orientation.HORIZONTAL // left
];
var isAppend = [false, true, true, false];

function _isinside_length(x, y) {
  return Math.sqrt(x * x + y * y);
}

function _isinside(v1x, v1y, v2x, v2y) {
  var l1 = _isinside_length(v1x, v1y);
  var l2 = _isinside_length(v2x, v2y);
  v1x /= l1; v1y /= l1;
  v2x /= l2; v2y /= l2;
  var dotproduct = v1x * v2x + v1y * v2y;
  return /* -45° */ -0.7071067811865475 <= dotproduct && dotproduct <= 1 /* 90 ° */;
}

function isinside(px, py, ax, ay, bx, by) {
  var v1x, v1y, v2x, v2y;
  return _isinside(bx - ax, by - ay, px - ax, py - ay)
      && _isinside(ax - bx, ay - by, px - bx, py - by);
}

function dropPlaceBetween(x: number, y: number, inner: ClientRect) : DockLayout.Position {
  var ret= DockLayout.Position.MIDDLE;
  if (y <= inner.top && isinside(x, y, inner.left, inner.top, inner.right, inner.top))
    ret= DockLayout.Position.TOP;
  else if (x >= inner.right && isinside(x, y, inner.right, inner.top, inner.right, inner.bottom))
    ret= DockLayout.Position.RIGHT;
  else if (y >= inner.bottom && isinside(x, y, inner.right, inner.bottom, inner.left, inner.bottom))
    ret= DockLayout.Position.BOTTOM;
  else if (x <= inner.left && isinside(x, y, inner.left, inner.bottom, inner.left, inner.top))
    ret= DockLayout.Position.LEFT;
  return ret;
}

function shrink(o: ClientRect, minpx: number, maxpourcent: number) {
  if (minpx >= 0 && maxpourcent >= 0)
    return reduceByPx(o, Math.min(o.height * maxpourcent, o.width * maxpourcent, minpx));
  else {
    maxpourcent = Math.abs(maxpourcent);
    minpx = Math.abs(minpx);
    return reduceByPx(o, -Math.max(o.height * maxpourcent, o.width * maxpourcent, minpx));
  }
}

function collapse(o: ClientRect) {
  return {
    top: o.top + o.height/2 - 1,
    right: o.right - o.width/2 + 1,
    bottom: o.bottom - o.height/2 + 1,
    left: o.left + o.width/2 - 1,
    width: 0,
    height: 0,
  };
}

function reduceByPercent(o: ClientRect, p) {
  var hpx = o.width * p;
  var vpx = o.height * p;
  return {
    top: o.top + vpx ,
    right: o.right - hpx,
    bottom: o.bottom - vpx,
    left: o.left + hpx,
    width: o.width - hpx * 2 ,
    height: o.height - vpx * 2,
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

function dropPlace(parent: HTMLElement, border: ClientRect, border1: ClientRect, lyplace: { place: DockLayout.Position, placeholder: HTMLElement }, reducepx) {
  var pos = { top: border.top, right: border.right, bottom: border.bottom, left: border.left };
  switch(lyplace.place) {
    case DockLayout.Position.TOP   : pos.bottom = border1.top   ; break;
    case DockLayout.Position.RIGHT : pos.left   = border1.right ; break;
    case DockLayout.Position.BOTTOM: pos.top    = border1.bottom; break;
    case DockLayout.Position.LEFT  : pos.right  = border1.left  ; break;
    default: pos.bottom = pos.top; pos.right = pos.left; break;
  }
  parent.appendChild(lyplace.placeholder);
  $(lyplace.placeholder).css({ top: pos.top, width: pos.right - pos.left, height: pos.bottom - pos.top, left: pos.left });
}

function ondrop(ev, cb: (view: ContentView) => any) {
  var view = ev.data && ev.data.view;
  if (view) {
    if (ev.dropEffect === dragndrop.DropAction.Copy)
      view = view.duplicate();
    cb(view);
  }
  else if (ev.externaldata && ev.externaldata.type) {
    view = ContentView.deserialize(ev.externaldata);
    if (view)
      cb(view);
  }
}

function appendViewTo(to: DockLayout.DockTabLayout | DockLayout.DockBoxLayout, view:ContentView, position:DockLayout.Position) {
  if (position === DockLayout.Position.MIDDLE) {
    (<DockLayout.DockTabLayout>to).appendView(view, true);
  }
  else {
    var orientation = orientations[position];
    if (to.parent instanceof DockLayout && to instanceof DockLayout.DockBoxLayout && (<any>to).orientation === orientation) {
      var tab = new DockLayout.DockTabLayout(to);
      to.insertView(tab, 0.25, isAppend[position] ? to.count : 0);
      tab.appendView(view, true);
      return;
    }
    if ((<DockLayout.DockBoxLayout>to.parent).orientation !== orientation) {
      var parent = new DockLayout.DockBoxLayout(to.parent, {orientation: orientation, userCanResize: true});
      to.parent.replaceView(to, parent);
      to.parent = parent;
      parent.appendView(to, 1.0);
    }
    var tab = new DockLayout.DockTabLayout(to.parent);
    var p = <DockLayout.DockBoxLayout>to.parent;
    var idx = p.findView(to);
    idx += isAppend[position] ? +1 : 0;
    p.insertView(tab, 0.25, idx);
    tab.appendView(view, true);
    // assert(idx != 0)
  }
}

function createPlaceholder() {
  var p = document.createElement('div');
  p.className = "docklayout-placeholder";
  return p;
}

class DockLayout extends View implements DockLayout.DockParentView {
  _items: DockLayout.DockItem[];
  _root: DockLayout.DockTabLayout | DockLayout.DockBoxLayout;
  _main: DockLayout.DockTabLayout;
  _delayLayoutChange: number;
  _scheduleLayoutChange;

  _init() {
    this._main = new DockLayout.DockTabLayout(this);
    this._main.canMinimize = false;
    this._main.canRemove = false;
    this._root = this._main;
  }
  constructor() {
    super();

    this.el.className = "docklayout";
    this._delayLayoutChange = 0;
    this._scheduleLayoutChange = util.schedule(() => {
      this._signal("layoutChange");
    });
    this._init();
    this._main.appendTo(this.el);

    var lyplace = { placeholder: <HTMLElement>null, place: DockLayout.Position.MIDDLE};
    dragndrop.droppable(this.el, {
      type: "tab",
      ondragstart: () => {
        this._delayLayoutChanges();
        $(this.el).toggleClass("docklayout-drop", true);
        this.resize();
      },
      ondragend:() => {
        $(this.el).toggleClass("docklayout-drop", false);
        this.resize();
        this._delayedLayoutChanges();
      },
      ondragover: (ev, data) => {
        if (!lyplace.placeholder) lyplace.placeholder = createPlaceholder();
        this.dropPlace(ev, lyplace);
        return lyplace.place !== DockLayout.Position.MIDDLE ? (ev.altKey ? dragndrop.DropAction.Copy : dragndrop.DropAction.Move) : dragndrop.DropAction.None;
      },
      ondragexit: (ev, data) => {
        if (!lyplace.placeholder) return;
        if (lyplace.placeholder.parentNode)
          lyplace.placeholder.parentNode.removeChild(lyplace.placeholder);
      },
      ondrop: (ev) => {
        ondrop(ev, (view) => { this.appendViewTo(view, lyplace.place); });
      }
    });
  }

  createViewIfNecessary(cstor, args, create?: () => ContentView) : ContentView {
    var ret = null;
    this.iterateViews((view, container) => {
      if (view instanceof cstor && view.isViewFor(...args)) {
        container.setCurrentView(view);
        ret = view;
        return true;
      }
    });
    if (!ret) {
      ret = create ? create() : new (Function.prototype.bind.apply(cstor, [cstor].concat(args)));
      this.main.appendViewTo(ret, DockLayout.Position.MIDDLE);
      this._layoutChange();
    }
    ret.focus();
    return ret;
  }

  dropPlace(ev: MouseEvent, lyplace: { place: DockLayout.Position, placeholder: HTMLElement }) {
    var x = ev.clientX, y = ev.clientY;
    var border0 = this.el.getBoundingClientRect();
    var border1 = shrink(border0, 25, 0.5);
    lyplace.place = dropPlaceBetween(x, y, border1);
    dropPlace(this.el, border0, border1, lyplace, 25);
  }

  root() {
    return this;
  }

  removeView(view) {
  }

  /* iterate accross all views of the dock layout, if the callback returns true the iteration ends */
  iterateViews(cb: (view: ContentView, container: DockLayout.DockTabLayout) => boolean) {
    function traverse(view: View) {
      for(var child of view.getChildViews()) {
        if (child instanceof DockLayout.DockTabLayout || child instanceof DockLayout.DockBoxLayout) {
          if(traverse(child) === true)
            return true;
        }
        else {
          if (cb(<ContentView>child, <DockLayout.DockTabLayout>view) === true)
            return true;
        }
      }
    }
    traverse(this._root);
  }

  get main() : DockLayout.DockTabLayout {
    return this._main;
  }

  _layoutChange() {
    if (this._delayLayoutChange === 0)
      this._scheduleLayoutChange();
    else
      this._delayLayoutChange = 2;
  }

  _delayLayoutChanges() {
    if (this._delayLayoutChange === 0)
      this._delayLayoutChange = 1;
  }

  _delayedLayoutChanges() {
    if (this._delayLayoutChange === 2)
      this._scheduleLayoutChange();
    this._delayLayoutChange = 0;
  }

  deserialize(data) {
    this._delayLayoutChanges();
    this._root.destroy();
    this._init();
    var traverse = (data, parent) : any => {
      var type = data.type;
      if (type === "hbox" || type === "vbox") {
        var box = new DockLayout.DockBoxLayout(parent, {
          orientation: type === "hbox" ? BoxLayout.Orientation.HORIZONTAL : BoxLayout.Orientation.VERTICAL,
          userCanResize: true
        });
        box._setViews(data.items.map((item) => {
          return { view: traverse(item, box), size: item.size };
        }));
        return box;
      }
      else if (type === "main" || type === "tabs") {
        var tabs = type === "main" ? this._main : new DockLayout.DockTabLayout(parent);
        tabs.parent = parent;
        data.tabs.forEach((item) => {
          var view = ContentView.deserialize(item);
          if (view) tabs.appendView(view);
        });
        if (data.tabindex > 0)
          tabs.setCurrentIdx(data.tabindex);
        return tabs;
      }
      throw new Error("invalid layout data, type '"+type+"' unknown");
    }
    this._root = traverse(data, this);
    this._root.appendTo(this.el);
    this._delayedLayoutChanges();
  }

  serialize() {
    var main = this._main;
    function traverse(view, r) {
      if (view instanceof DockLayout.DockBoxLayout)
        traversebox(view, r);
      else
        traversetabs(view, r);
    }
    function traversebox(view: DockLayout.DockBoxLayout, ret) {
      ret.type = view._orientation === BoxLayout.Orientation.HORIZONTAL ? "hbox" : "vbox";
      ret.items = view._items.map(function(item) {
        var r = { size: item.size };
        traverse(item.view, r);
        return r;
      });
    }
    function traversetabs(view: DockLayout.DockTabLayout, ret) {
      ret.type = view !== main ? "tabs" : "main";
      ret.tabs = view._tabs.map(function(item) {
        return item.view.serialize();
      });
      ret.tabindex = view.currentIdx();
    }
    var ret = {};
    traverse(this._root, ret);
    return ret;
  }

  getChildViews() : View[] {
    return [this._root];
  }

  replaceView(oldView: DockLayout.DockTabLayout | DockLayout.DockBoxLayout, newView: DockLayout.DockTabLayout | DockLayout.DockBoxLayout) {
    if (this._root !== oldView) throw "Dock layout is corrupted";
    this._root = newView;
    this._root.appendTo(this.el);
    this.render();
  }

  appendViewTo(view:ContentView, position:DockLayout.Position) {
    appendViewTo(this._root, view, position);
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
      this.on("resized", () => { this.root()._layoutChange() });
    }

    appendView(view:DockTabLayout | DockBoxLayout, size:number) {
      super.appendView(view, size);
    }

    insertView(view:DockTabLayout | DockBoxLayout, size: number, at: number) {
      super.insertView(view, size, at);
    }

    removePart(at: number, destroy?) {
      super.removePart(at, destroy);
      if (this.count == 1) { // Simplify the layout
        var view = <DockTabLayout | DockBoxLayout>this._items[0].view;
        this.removePart(0);
        this.parent.replaceView(this, view);
        view.parent = this.parent;
        this.destroy();
      }
    }
  }

  export class DockTabLayout extends TabLayout {
    canRemove:boolean = true;
    canMinimize:boolean = true;

    constructor(public parent:DockParentView) {
      super();
      var tabplaceholder: HTMLElement;
      var tabidx: number;
      dragndrop.droppable(this._elTabs, {
        type: "tab",
        ondragover: (ev, data) => {
          if (!tabplaceholder) tabplaceholder = this.createPlaceholderTab();
          tabidx= this.dropTabUpdatePlaceholder(ev, tabplaceholder);
          return ev.altKey ? dragndrop.DropAction.Copy : dragndrop.DropAction.Move;
        },
        ondragexit: (ev, data) => {
          if (!tabplaceholder) return;
          if (tabplaceholder.parentNode === this._elTabs)
            this._elTabs.removeChild(tabplaceholder);
          tabplaceholder = null;
        },
        ondrop: (ev) => {
          ondrop(ev, (view) => { this.insertView(view, tabidx, true); });
        }
      });
      var lyplace = { placeholder: <HTMLElement>null, place: DockLayout.Position.MIDDLE};
      dragndrop.droppable(this._elContent, {
        type: "tab",
        ondragover: (ev, data) => {
        if (!lyplace.placeholder) lyplace.placeholder = createPlaceholder();
          this.dropPlace(ev, lyplace);
          return lyplace.place !== DockLayout.Position.MIDDLE ? (ev.altKey ? dragndrop.DropAction.Copy : dragndrop.DropAction.Move) : dragndrop.DropAction.None;
        },
        ondragexit: (ev, data) => {
          if (!lyplace.placeholder) return;
          if (lyplace.placeholder.parentNode)
            lyplace.placeholder.parentNode.removeChild(lyplace.placeholder);
        },
        ondrop: (ev) => {
          ondrop(ev, (view) => { this.appendViewTo(view, lyplace.place); });
        }
      });
    }

    exportLayout() {
      return {
        type:"tabs",
        childs: this.getChildViews().map((c: any) => { return "tab"; })
      }
    }

    dropPlace(ev: MouseEvent, lyplace: { place: DockLayout.Position, placeholder: HTMLElement }) {
      var x = ev.clientX, y = ev.clientY;
      var border0 = this._elContent.getBoundingClientRect();
      var border1 = reduceByPercent(border0, 0.25);
      lyplace.place = dropPlaceBetween(x, y, border1);
      dropPlace(this.el, border0, border1, lyplace, 0);
    }

    dropTabUpdatePlaceholder(ev: MouseEvent, placeholder: HTMLElement) {
      if (placeholder.parentNode === this._elTabs)
        this._elTabs.removeChild(placeholder);
      var idx = this.dropTabIndex(ev);
      this._elTabs.insertBefore(placeholder, idx < this._tabs.length ? this._tabs[idx].tab : null);
      return idx;
    }

    dropTabIndex(ev: MouseEvent) {
      var x = ev.clientX;
      var y = ev.clientY;
      var tabs = this._tabs;
      var idx = tabs.length;
      var pos = this.position();
      var h = pos == TabLayout.Position.TOP || pos == TabLayout.Position.BOTTOM;
      for (var i= 0; i < idx; ++i) {
        var tab: HTMLElement = tabs[i].tab;
        var rect = tab.getBoundingClientRect();
        if (h && x < rect.left + rect.width / 2)
          idx= i;
        if (!h && y < rect.top + rect.height / 2)
          idx= i;
      }
      return idx;
    }

    root() {
      return this.parent.root();
    }

    setCurrentIdx(current:number, force?: boolean) {
      var c = this._current;
      super.setCurrentIdx(current, force);
      if (this._current !== c)
        this.root()._layoutChange();
    }

    insertView(view:ContentView, at:number, makeCurrent?: boolean) {
      super.insertView(view, at, makeCurrent);
      this.root()._layoutChange();
    }

    appendViewTo(view:ContentView, position:Position) {
      appendViewTo(this, view, position);
    }

    removeTab(at: number, destroy: boolean = false, canRemove: boolean = true) {
      super.removeTab(at, destroy);
      if (canRemove) this.removeIfEmpty();
      this.root()._layoutChange();
    }

    removeIfEmpty() {
      if (this._tabs.length == 0 && this.canRemove) {
        this.parent.removeView(this);
        this.destroy();
      }
    }

    createTab(view: ContentView, at:number) {
      var item = super.createTab(view, at);
      dragndrop.draggable(item.tab, {
        type: "tab",
        data: item,
        dnd: item.view.dragndrop ? item.view.dragndrop.bind(item.view) : null,
        ondragstart: () => {
          $(item.tab).addClass("ghost");
        },
        ondragend: (dropped, data) => {
          $(item.tab).removeClass("ghost");
          if (dropped === dragndrop.DropAction.Move)
            this.removeTab(item.idx, false);
        }
      });
      return item;
    }

  }
}

export = DockLayout;
