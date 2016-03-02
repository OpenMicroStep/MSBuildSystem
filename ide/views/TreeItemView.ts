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

  id: string;
  nameContainer: HTMLElement;
  caret: HTMLElement;
  childsContainer: HTMLElement;
  childs: TreeItemView[];
  $caretclick;
  state: State;

  constructor(id = null) {
    super();
    this.id = id;
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
      this.caret.className = "fa fa-fw";
      this.caret.removeEventListener('click', this.$caretclick, false);
      this.$caretclick = null;
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
    async.run(null, this.expandAsync.bind(this));
  }

  expandAsync(p) {
    if (this.state !== State.COLLAPSED) return p.continue();
    this.state = State.EXPANDING;
    p.setFirstElements([
      this.createChildItems.bind(this),
      (p) => {
        this.state = State.EXPANDED;
        this.caret.className = "fa fa-fw fa-caret-down";
        p.continue();
      }
    ]);
    p.continue();
    if (this.state === State.EXPANDING) // Async loading
      this.caret.className = "fa fa-fw fa-circle-o-notch fa-spin";
  }

  collapse() {
    if (this.state !== State.EXPANDED) return;
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

  setExpandData(data) {
    if (data && data.expanded) {
      async.run(null, [
        this.expandAsync.bind(this),
        (p) => {
          var childs = data.childs || [];
          for (var i = 0, j = 0, dlen = childs.length, clen = this.childs.length; i < dlen && j < clen;) {
            var d = childs[i];
            var c = this.childs[j];
            if (c.id === d.id) {
              c.setExpandData(d);
              ++i;
            }
            else {
              c.setExpandData(null);
            }
            ++j;
          }
        }
      ]);
    }
  }

  expandData() {
    return { id: this.id, expanded: this.state === State.EXPANDED, childs: this.childs.map((c, idx) => { return c.expandData(); })};
  }
}

export = TreeItemView;
