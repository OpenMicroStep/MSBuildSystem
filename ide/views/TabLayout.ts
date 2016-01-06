/// <reference path="../../typings/browser.d.ts" />

import View = require('./View');
import ContentView = require('./ContentView');
import menu = require('../core/menu');

type TabItem = {
  view: ContentView;
};

enum Position {
  TOP,
  RIGHT,
  BOTTOM,
  LEFT
}

class TabLayout extends View {
  _tabs:TabItem[];
  _current:number;
  _position:Position;
  _elTabs:HTMLElement;
  _elContent:HTMLElement;

  constructor() {
    super();
    this._tabs = [];
    this._current = -1;

    this._elTabs = document.createElement('div');
    this._elTabs.className = "tablayout-tabs";

    this._elContent = document.createElement('div');
    this._elContent.className = "tablayout-content";

    this._position = Position.TOP;

    this.el.className = "tablayout";
    this.el.appendChild(this._elTabs);
    this.el.appendChild(this._elContent);
  }

  getChildViews():View[] {
    return this._tabs.map(function (item:TabItem) {
      return item.view;
    });
  }

  get position():Position {
    return this._position;
  }
  set position(position:Position) {
    this._position = position;
    this.renderPosition();
  }

  get current():number {
    return this._current;
  }
  set current(current:number) {
    if (current < 0 || current >= this._tabs.length) throw  "'current' is out of bounds [0, " + this._tabs.length + "[";
    this._current = current;
    this.renderTabs();
    this.renderContent();
    if (this._current !== -1)
      this._tabs[this._current].view.focus();
  }

  get currentView():ContentView {
    return this._current === -1 ? null : this._tabs[this._current].view;
  }
  set currentView(current:ContentView) {
    var idx = this.findView(current);
    if (idx !== -1) this.current = idx;
  }

  get count() {
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

  insertView(view:ContentView, at:number, makeCurrent?: boolean) {
    if (at < 0 || at > this._tabs.length) throw  "'at' is out of bounds [0, " + this._tabs.length + "]";
    this._tabs.splice(at, 0, {view: view});
    if (this._current === -1 || makeCurrent === true) this._current = at;
    this.render();
  }
  removeView(view, destroy: boolean = false) {
    var idx = this._tabs.findIndex((item) => {
      return item.view === view;
    });
    if (idx != -1) {
      this.removeTab(idx, destroy);
    }
  }

  removeTab(at:number, destroy: boolean = false) {
    if (at < 0 || at >= this._tabs.length) throw  "'at' is out of bounds [0, " + this._tabs.length + "[";
    if (destroy)
      this._tabs[at].view.destroy();
    this._tabs.splice(at, 1);
    if (this._current >= at)
      --this._current;
    if (this._current === -1 && this._tabs.length)
      this._current = 0;
    this.render();
  }

  moveTab(from:number, to:number) {
    if (from < 0 || from >= this._tabs.length) throw  "'from' is out of bounds [0, " + this._tabs.length + "[";
    if (to < 0 || to >= this._tabs.length) throw  "'to' is out of bounds [0, " + this._tabs.length + "[";

    var tmp = this._tabs[from];
    this._tabs[from] = this._tabs[to];
    this._tabs[to] = tmp;
    this.render();
  }

  renderPosition() {
    this.$el.toggleClass("tablayout-top", this._position == Position.TOP);
    this.$el.toggleClass("tablayout-right", this._position == Position.RIGHT);
    this.$el.toggleClass("tablayout-bottom", this._position == Position.BOTTOM);
    this.$el.toggleClass("tablayout-left", this._position == Position.LEFT);
  }

  render() {
    this.renderPosition();
    this.renderContent();
    this.renderTabs();
  }

  renderContent() {
    this._elContent.innerHTML = "";
    if (this._current !== -1) {
      var view = this._tabs[this._current].view;
      this._elContent.appendChild(view.el);
      view.resize();
    }
  }

  renderTabs():void {
    this._elTabs.innerHTML = "";
    this._tabs.forEach((item:TabItem, idx:number) => {
      this.renderTab(item, idx);
    });
  }

  createPlaceholderTab() {
    var domItem:HTMLElement;
    domItem = document.createElement('div');
    domItem.className = "tablayout-tab placeholder active";
    return domItem;
  }

  renderTab(item:TabItem, idx:number) {
    var domItem:HTMLElement;
    domItem = document.createElement('div');
    domItem.className = "tablayout-tab";
    item.view.appendTitleTo(domItem);
    domItem.addEventListener('click', (event) => {
      this.current = idx;
      this.render();
    });
    menu.bindContextMenuTo(domItem, () => {
      var items = [{
        label: "Close",
        click: () => {
          this.removeTab(idx, true);
        }
      },{
        label: "Close other tabs",
        click: () => {
          var i;
          for (i = this.count - 1; i > idx; --i)
            this.removeTab(i, true);
          for (i = idx - 1; i >= 0; --i)
            this.removeTab(i, true);
        }
      },{
        label: "Close tabs to the right",
        click: () => {
          for (var i = this.count - 1; i > idx; --i)
            this.removeTab(i, true);
        }
      },{
        label: "Close tabs to the left",
        click: () => {
          for (var i = idx - 1; i >= 0; --i)
            this.removeTab(i, true);
        }
      }];
      if (item.view.duplicate) {
        items.push({
          label: "Duplicate view",
          click: () => {
            this.insertView(item.view.duplicate(), idx + 1, false);
          }
        });
      }
      return items;
    });
    if (idx === this._current)
      domItem.className += " active";
    this._elTabs.appendChild(domItem);
    return domItem;
  }
}

var _Position = Position;
module TabLayout {
  export var Position = _Position;
}

export = TabLayout;

