/// <reference path="../../../typings/browser.d.ts" />

import View = require('./View');

class IDE extends View {
  /**
   * GET files => FileTree
   * POST addFile(file: FileInfo, parent: id)
   * POST chgFile(changes: );
   * POST swpFile(file1: id, file2: id)
   *
   * GET targets(): TargetInfo[]
   * POST addTarget(target: TargetInfo)
   * POST chgTarget(changes: );
   * POST swpTarget(target1: id, target2: id)
   *
   * POST save()
   *
   * GET fileContent(): string
   * POST chgContent(start: number, length: number, by: string)
   *
   *
   */
  workspace;
  left: HTMLElement;
  main: HTMLElement;
  workspaceName: HTMLElement;
  constructor() {
    super();

    var top = document.createElement('div');
    top.className = "section-top.navbar navbar-fixed-top navbar-default";
    this.workspaceName = document.createElement('a');
    this.workspaceName.className = "navbar-brand";
    top.appendChild(this.workspaceName);
    this.el.appendChild(top);

    this.left = document.createElement('div');
    this.left.className = "section-left";

    this.main = document.createElement('div');
    this.main.className = "section-main";
  }

  setLeftView(view: View) {
    this.left.innerHTML = "";
    this.left.appendChild(view.el);
  }

  setMainView(view: View) {
    this.main.innerHTML = "";
    this.main.appendChild(view.el);
  }
}

export = IDE;