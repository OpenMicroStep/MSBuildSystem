import core = require('../core');
import GoToView = require('./GoToView');
import EditorView = require('./EditorView');
import Workspace = require('../client/Workspace');

function searchInFiles(text: string, w, files: any[], results: any[]) {
  for (var i = 0, len = files.length; i < len; ++i) {
    var file = files[i];
    if (file.file) {
      var path = file.file;
      var dist1 = core.util.stringDistance(text, core.util.pathBasename(path));
      var dist2 = core.util.stringDistance(text, path);
      if (dist1 < Number.MAX_SAFE_INTEGER || dist2 < Number.MAX_SAFE_INTEGER)
        results.push({ dist1: dist1, dist2: dist2, path: path, workspace: w });
    }
    if (file.files) {
      searchInFiles(text, w, file.files, results);
    }
  }
}

function sortSearchResult(a, b) {
  if (a.dist1 === b.dist1)
    return a.dist2 - b.dist2;
  return a.dist1 - b.dist1;
}

class GoToFile extends GoToView {
  row: number;

  constructor() {
    super();
    this.update();
  }

  search() : any[] {
    this.str = this.str.toLowerCase();
    this.row = undefined;
    var m = this.str.match(/:(\d*)$/);
    if (m) {
      this.str = this.str.substring(0, m.index);
      this.row = m[1].length > 0 ? parseInt(m[1]) - 1 : undefined;
    }
    var results = [];
    if (this.str.length > 0) {
      Workspace.workspaces.forEach((w) => {
        searchInFiles(this.str, w, w.files, results);
        searchInFiles(this.str, w, [{ file: 'make.js' }], results);
      })
      results = results.sort(sortSearchResult);
    }
    return results;
  }

  createItem(result: any) : HTMLElement {
    var el = super.createItem(result);
    var b = document.createElement('b');
    var w = document.createElement('span');
    w.className = "pull-right";
    w.textContent = result.workspace.name;
    el.appendChild(w)
    el.appendChild(b);
    core.util.appendStringDistanceToElement(b, this.str, core.util.pathBasename(result.path));
    el.appendChild(document.createElement('br'));
    core.util.appendStringDistanceToElement(el, this.str, result.path);
    return el;
  }

  compareResults(a, b) {
    return a.file === b.file;
  }

  goToSelection() {
    if (this.str.length == 0 && this.row !== void 0 && core.globals.ide._focus instanceof EditorView) {
      (<EditorView>core.globals.ide._focus).goTo({ row: this.row });
      this.destroy();
    }
    else
      super.goToSelection();
  }

  goTo(result: any) {
    core.async.run(null, (p) => { core.globals.ide.openFile(p, { path: result.workspace.filePath(result.path), row: this.row }); });
    super.goTo(result);
  }
}

export = GoToFile;
