/// <reference path="../../typings/browser.d.ts" />
"use strict";
import View = require('./View');
import globals = require('./globals');

class ContentView extends View {
  titleEl : HTMLElement;

  constructor(tagName: string = "div", titleTagName: string = "div") {
    super(tagName);
    this.titleEl = document.createElement(titleTagName);
    this.el.addEventListener('click', this.focus.bind(this));
  }

  destroy() {
    super.destroy();
    if (globals.ide.focus === this)
      globals.ide.setCurrentView(null);
  }

  focus() {
    globals.ide.setCurrentView(this);
  }

  appendTitleTo(el:HTMLElement):void {
    el.appendChild(this.titleEl);
    this.resizeTitle();
  }

  resizeTitle() {

  }

  renderTitle() {

  }
}

export = ContentView;
