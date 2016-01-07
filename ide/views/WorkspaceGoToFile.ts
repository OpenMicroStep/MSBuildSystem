/// <reference path="../../typings/browser.d.ts" />

import core = require('../core');
import GoToView = require('./GoToView');
import Workspace = require('../client/Workspace');

function searchInFiles(text: string, files: any[], results: any[]) {
  for (var i = 0, len = files.length; i < len; ++i) {
    var file = files[i];
    if (file.file) {
      var dist1 = core.util.stringDistance(text, core.util.pathBasename(file.file));
      var dist2 = core.util.stringDistance(text, file.file);
      if (dist1 < Number.MAX_SAFE_INTEGER || dist2 < Number.MAX_SAFE_INTEGER)
        results.push({ dist1: dist1, dist2: dist2, file: file });
    }
    if (file.files) {
      searchInFiles(text, file.files, results);
    }
  }
}

function sortSearchResult(a, b) {
  if (a.dist1 === b.dist1)
    return a.dist2 - b.dist2;
  return a.dist1 - b.dist1;
}

class WorkspaceGoToFile extends GoToView {
  constructor(public workspace: Workspace) {
    super();
    this.update();
  }

  search() : any[] {
    this.str = this.str.toLowerCase();
    var results = [];
    searchInFiles(this.str, this.workspace.files, results);
    return this.str.length > 0 ? results.sort(sortSearchResult) : results;
  }

  createItem(result: any) : HTMLElement {
    var el = super.createItem(result);
    var b = document.createElement('b');
    el.appendChild(b);
    core.util.appendStringDistanceToElement(b, this.str, core.util.pathBasename(result.file.file));
    el.appendChild(document.createElement('br'));
    core.util.appendStringDistanceToElement(el, this.str, result.file.file);
    return el;
  }

  compareResults(a, b) {
    return a.file === b.file;
  }

  goTo(result: any) {
    core.async.run(null, [
      (p) => { this.workspace.openFile(p, result.file.file); },
      (p) => { core.globals.ide.openFile(p.context.result); p.continue(); }
    ]);
    super.goTo(result);
  }
}

export = WorkspaceGoToFile;
