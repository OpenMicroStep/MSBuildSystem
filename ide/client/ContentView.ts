/// <reference path="../../typings/browser.d.ts" />
"use strict";
import View = require('./View');

class ContentView extends View {
  titleEl : HTMLElement;

  constructor(tagName: string = "div", titleTagName: string = "div") {
    super(tagName);
    this.titleEl = document.createElement(titleTagName);
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
