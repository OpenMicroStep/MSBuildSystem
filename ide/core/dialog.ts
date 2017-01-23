import View = require('../views/View');
import globals = require('./globals');

var menus: { menu: HTMLElement, clear: () => void }[] = [];
var onclear = new Set<() => void>();
var dialogsParent = document.createElement('div');
dialogsParent.className = "dialogs";
document.body.appendChild(dialogsParent);

export class Dialog extends View {
  constructor() {
    super();
  }
}
