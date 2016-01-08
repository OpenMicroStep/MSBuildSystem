/// <reference path="../../typings/browser.d.ts" />

import core = require('../core');

class GoToView extends core.View {
  inputEl: HTMLInputElement;
  listEl: HTMLElement;
  str: string;
  results: any[];
  selection: { result: any, index: number };

  constructor() {
    super();
    this.str = "";
    this.results = [];
    this.selection = { result: null, index: 0};
    this.el.className = "goto";

    this.inputEl = document.createElement("input");
    this.inputEl.className = "form-control";
    this.inputEl.addEventListener("keydown", (e) => {
      if (e.which == 40) // down
        this.moveSelection(+1);
      else if (e.which == 38) // up
        this.moveSelection(-1);
      else if (e.which == 13) // enter
        this.goToSelection();
      else if (e.which == 27) // esc
        this.destroy();
      else {
        setTimeout(() => { this.update() }, 0);
        return;
      }
      e.preventDefault();
    }, false);
    this.el.appendChild(this.inputEl);

    this.listEl = document.createElement("div");
    this.el.appendChild(this.listEl);
  }

  createItem(result: any) : HTMLElement {
    var el = document.createElement("div");
    el.className = "goto-item";
    return el;
  }

  attach() {
    document.body.appendChild(this.el);
    this.inputEl.focus()
  }

  moveSelection(nb: number) {
    var idx = this.selection.index + nb;
    if (0 <= idx && idx < this.results.length) {
      $(this.listEl.childNodes[this.selection.index]).removeClass("active");
      this.selection.index = idx;
      this.selection.result = this.results[idx];
      $(this.listEl.childNodes[this.selection.index]).addClass("active");
      this.scrollToSelection();
    }
  }

  scrollToSelection() {
    core.util.scrollIntoViewIfNeeded(this.listEl.childNodes[this.selection.index]);
  }

  update() {
    this.str = this.inputEl.value;
    this.results = this.search();
    $(this.listEl).empty();
    var selIdx = this.selection.result ? -1 : 0;
    this.results.forEach((result, idx) => {
      if (selIdx === -1 && this.compareResults(result, this.selection.result))
        selIdx = idx;
      this.listEl.appendChild(this.createItem(result));
    });
    this.selection.result = this.selection.result && selIdx !== -1 ? this.results[selIdx] : null;
    this.selection.index = selIdx !== -1 ? selIdx : 0;
    if (this.results.length > 0) {
      $(this.listEl.childNodes[this.selection.index]).addClass("active");
      this.scrollToSelection();
    }
  }

  compareResults(a, b) {
    return a === b;
  }

  search() : any[] {
    return [];
  }

  goToSelection() {
    if (this.selection.index < this.results.length)
      this.goTo(this.results[this.selection.index]);
  }
  goTo(result: any) {
    this.destroy();
  }
}

export = GoToView;
