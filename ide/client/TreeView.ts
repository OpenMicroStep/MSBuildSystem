/// <reference path="../../typings/browser.d.ts" />
"use strict";
import View = require('./View');
import ContentView = require('./ContentView');

class TreeView extends ContentView {
  root: TreeView.TreeItem;
  constructor(name: string) {
    super();
    this.titleEl.textContent = name;
    this.el.className = "tree";
  }

  getChildViews() {
    return [this.root];
  }

  resize() {

  }

  decode(s : TreeView.SerializedTree) {

  }
  encode() : TreeView.SerializedTree {
    var r = <TreeView.SerializedTree>super.encode();
    return r;
  }
}

module TreeView {
  export class TreeItem extends View {
    childsContainer: HTMLElement;
    childs: TreeItem[];

    constructor() {
      super();
      this.el.className = "tree-item";
      this.childsContainer = document.createElement('div');
      this.childsContainer.className = "tree-childs";
      this.childs = [];
    }
    getChildViews() {
      return this.childs;
    }
  }
  export interface SerializedTree extends View.SerializedView {
  }
}

export = TreeView;
