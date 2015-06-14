/// <reference path="../../../typings/browser.d.ts" />

class View {
  el: Element;
  $el: JQuery;

  constructor() {
    this.el = this.createElement();
    this.$el = jQuery(this.el);
  }

  /** update the view */
  render() {

  }

  protected createElement() {
    return document.createElement('div');
  }

  static placeholder() : View {
    return new View();
  }
}

export = View;