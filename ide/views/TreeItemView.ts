/// <reference path="../../typings/browser.d.ts" />

import View = require('./View');

class TreeItemView extends View {
  nameContainer: HTMLElement;
  childsContainer: HTMLElement;
  childs: TreeItemView[];
  expanded: boolean;

  constructor() {
    super();
    this.el.className = "tree-item";
    this.nameContainer = document.createElement('div');
    this.childsContainer = document.createElement('div');
    this.childsContainer.className = "tree-childs";
    this.childs = [];
    this.el.appendChild(this.nameContainer);
    this.el.appendChild(this.childsContainer);
    this.expanded = false;
  }

  expand() {
    this.expanded = true;
  }

  collapse() {
    this.expanded = false;
  }

  toggle() {
    if (this.expanded)
      this.collapse();
    else
      this.expand();
  }

  addChildItem(v: TreeItemView) {
    this.childs.push(v);
    this.childsContainer.appendChild(v.el);
  }

  removeChildItems() {
    this.childs.length = 0;
    this.childsContainer.innerHTML = '';
  }

  getChildViews() {
    return this.childs;
  }
}

export = TreeItemView;
