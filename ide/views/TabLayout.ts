import View = require('./View');
import ContentView = require('./ContentView');
import menu = require('../core/menu');

type TabItem = {
  view: ContentView;
  tab: HTMLElement;
  idx: number;
};

enum Position {
  TOP,
  RIGHT,
  BOTTOM,
  LEFT
}

class TabLayout extends View {
  _tabs:TabItem[];
  _current:TabItem;
  _position:Position;
  _elTabs:HTMLElement;
  _elContent:HTMLElement;

  constructor() {
    super();
    this._tabs = [];
    this._current = null;

    var tabs = document.createElement('div');
    tabs.className = "tablayout-tabs";
    this._elTabs = document.createElement('div');
    tabs.appendChild(this._elTabs);

    this._elContent = document.createElement('div');
    this._elContent.className = "tablayout-content";

    this.el.className = "tablayout";
    this.setPosition(Position.TOP);

    this.el.appendChild(tabs);
    this.el.appendChild(this._elContent);
  }

  getChildViews():View[] {
    return this._tabs.map(function (item:TabItem) {
      return item.view;
    });
  }

  position():Position {
    return this._position;
  }
  setPosition(position:Position) {
    this._position = position;
    this.$el.toggleClass("tablayout-top", this._position == Position.TOP);
    this.$el.toggleClass("tablayout-right", this._position == Position.RIGHT);
    this.$el.toggleClass("tablayout-bottom", this._position == Position.BOTTOM);
    this.$el.toggleClass("tablayout-left", this._position == Position.LEFT);
  }

  currentItem(): TabItem {
    return this._current;
  }
  currentView():ContentView {
    return this._current ? this._current.view : null;
  }
  currentIdx(): number {
    return this._current ? this._current.idx : -1;
  }
  setCurrentIdx(current:number, force?: boolean) {
    if (this._current && current === this._current.idx && !force) return;
    if (this._current)
      $(this._current.tab).removeClass('active');
    this._current = current >= 0 && current < this._tabs.length ? this._tabs[current] : null;
    this._elContent.innerHTML = "";
    if (this._current) {
      $(this._current.tab).addClass('active');
      var view = this._current.view;
      this._elContent.appendChild(view.el);
      view.resize();
      view.focus();
    }
  }
  setCurrentView(current:ContentView) {
    var idx = this.findView(current);
    if (idx !== -1) this.setCurrentIdx(idx);
  }

  count() {
    return this._tabs.length;
  }

  findView(view: ContentView) : number {
    return this._tabs.findIndex((item) => {
      return item.view === view;
    });
  }

  appendView(view:ContentView, makeCurrent?: boolean) {
    this.insertView(view, this._tabs.length, makeCurrent);
  }

  _insert(idx: number) {
    this._elTabs.insertBefore(this._tabs[idx].tab, idx + 1 < this._tabs.length ? this._tabs[idx + 1].tab : null);
  }

  insertView(view:ContentView, at:number, makeCurrent?: boolean) {
    if (at < 0 || at > this._tabs.length) throw  "'at' is out of bounds [0, " + this._tabs.length + "]";
    var item = this.createTab(view, at);
    this._tabs.splice(at, 0, item);
    for (var i = at + 1, len = this._tabs.length; i < len; ++i)
      this._tabs[i].idx++;
    this._insert(at);
    if (!this._current || makeCurrent === true)
      this.setCurrentIdx(at);
  }
  removeView(view, destroy: boolean = false) {
    var idx = this._tabs.findIndex((item) => {
      return item.view === view;
    });
    if (idx != -1)
      this.removeTab(idx, destroy);
  }

  removeTab(at:number, destroy: boolean = false) {
    if (at < 0 || at >= this._tabs.length) throw  "'at' is out of bounds [0, " + this._tabs.length + "[";
    var item = this._tabs[at];
    if (destroy)
      item.view.destroy();
    for (var i = at + 1, len = this._tabs.length; i < len; ++i)
      this._tabs[i].idx--;
    this._tabs.splice(at, 1);
    this._elTabs.removeChild(item.tab);
    if (this._current === item)
      this.setCurrentIdx(at < this._tabs.length ? at : this._tabs.length - 1, true);
  }

  moveTab(from:number, to:number) {
    if (from < 0 || from >= this._tabs.length) throw  "'from' is out of bounds [0, " + this._tabs.length + "[";
    if (to < 0 || to >= this._tabs.length) throw  "'to' is out of bounds [0, " + this._tabs.length + "[";

    var f = this._tabs[from];
    var t = this._tabs[to];
    f.idx = to;
    t.idx = from;
    this._tabs[from] = t;
    this._tabs[to] = f;
    this._insert(from);
    this._insert(to);
  }

  createPlaceholderTab() {
    var domItem:HTMLElement;
    domItem = document.createElement('div');
    domItem.className = "tablayout-tab placeholder active";
    return domItem;
  }

  createTab(view: ContentView, at:number) : TabItem {
    var domItem:HTMLElement;
    domItem = document.createElement('div');
    domItem.className = "tablayout-tab";
    view.appendTitleTo(domItem);
    var item = { view: view, idx: at, tab: domItem };
    domItem.addEventListener('click', (event) => { this.setCurrentIdx(item.idx); });
    menu.bindContextMenuTo(domItem, () => {
      var items = [{
        label: "Close",
        click: () => {
          this.removeTab(item.idx, true);
        }
      },{
        label: "Close other tabs",
        click: () => {
          var i;
          for (i = this.count() - 1; i > item.idx; --i)
            this.removeTab(i, true);
          for (i = item.idx - 1; i >= 0; --i)
            this.removeTab(i, true);
        }
      },{
        label: "Close tabs to the right",
        click: () => {
          for (var i = this.count() - 1; i > item.idx; --i)
            this.removeTab(i, true);
        }
      },{
        label: "Close tabs to the left",
        click: () => {
          for (var i = item.idx - 1; i >= 0; --i)
            this.removeTab(i, true);
        }
      }];
      if (item.view.duplicate) {
        items.push({
          label: "Duplicate view",
          click: () => {
            this.insertView(item.view.duplicate(), item.idx + 1, false);
          }
        });
      }
      return items;
    });
    return item;
  }
}

var _Position = Position;
module TabLayout {
  export var Position = _Position;
}

export = TabLayout;

