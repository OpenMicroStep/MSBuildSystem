import async = require('../core/async');
import View = require('./View');

enum State {
  LEAF,
  COLLAPSED,
  EXPANDING,
  EXPANDED,
}

class TreeItemView extends View {
  static State = State;

  nameContainer: HTMLElement;
  caret: HTMLElement;
  childsContainer: HTMLElement;
  childs: TreeItemView[];
  $caretclick;
  state: State;

  constructor() {
    super();
    this.el.className = "tree-item";
    this.caret = document.createElement('span');
    this.nameContainer = document.createElement('div');
    this.caret.className = "fa fa-fw";
    this.$caretclick = null;
    this.state = State.LEAF;
    this.childsContainer = document.createElement('div');
    this.childsContainer.className = "tree-childs";
    this.childs = [];
    this.nameContainer.appendChild(this.caret);
    this.el.appendChild(this.nameContainer);
    this.el.appendChild(this.childsContainer);
  }

  setCanExpand(canexpand: boolean) {
    if (this.$caretclick && !canexpand) {
      this.state = State.LEAF;
      this.removeChildItems(true);
      this.caret.removeEventListener('click', this.$caretclick, false);
    }
    else if (!this.$caretclick && canexpand) {
      this.state = State.COLLAPSED;
      this.caret.className = "fa fa-fw fa-caret-right";
      this.caret.addEventListener('click', this.$caretclick = (e) => {
        this.toggle();
        e.stopPropagation();
        e.preventDefault();
      }, false);
    }
  }

  createChildItems(p: async.Async) {
    p.continue();
  }

  expand() {
    this.state = State.EXPANDING;
    async.run(null, [
      this.createChildItems.bind(this),
      (p) => {
        this.state = State.EXPANDED;
        this.caret.className = "fa fa-fw fa-caret-down";
        p.continue();
      }
    ]);
    if (this.state === State.EXPANDING) { // Async loading
      this.caret.className = "fa fa-fw fa-circle-o-notch fa-spin";
    }
  }

  collapse() {
    this.removeChildItems(true);
    this.caret.className = "fa fa-fw fa-caret-right";
    this.state = State.COLLAPSED;
  }

  toggle() {
    if (this.state === State.EXPANDED)
      this.collapse();
    else if (this.state === State.COLLAPSED)
      this.expand();
  }

  addChildItem(v: TreeItemView) {
    this.childs.push(v);
    this.childsContainer.appendChild(v.el);
  }

  removeChildItems(destroy: boolean = false) {
    this.childs.forEach((c) => {
      if (destroy)
        c.destroy();
      else
        c.detach();
    })
    this.childs.length = 0;
  }

  getChildViews() {
    return this.childs;
  }
}

export = TreeItemView;
