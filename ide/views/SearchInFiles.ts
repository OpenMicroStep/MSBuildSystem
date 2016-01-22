import core = require('../core');
import Workspace = require('../client/Workspace');
import EditorView = require('./EditorView');

function sortSearchResult(a, b) {
  if (a.dist1 === b.dist1)
    return a.dist2 - b.dist2;
  return a.dist1 - b.dist1;
}

class SearchInFiles extends core.ContentView {
  editor: EditorView.SimpleEditorView;
  $rx; $cs; $ww; $ctx; $search; $find;
  $filter;
  $pcase; $replacement; $replace;
  contextsize: number;

  constructor() {
    super();
    this.titleEl.textContent = "Search in files";
    this.el.className = "searchinfiles";

    var find = document.createElement('div');
    find.className = "searchinfiles-find";
    var group = document.createElement('div');
    group.className = "input-group";
    group.appendChild(this.createOptionBtnGroup([
      { label: ".*", tooltip: "Regular expression", id:"$rx" },
      { label: "Aa", tooltip: "Case sensitive", id:"$cs" },
      { label: "“”", tooltip: "Whole word", id:"$ww" },
      { label: "☰", tooltip: "Show context", id:"$ctx" },
    ]));
    group.appendChild(this.createInput({ id: "$search", placeholder: "Search for..." }));
    group.appendChild(this.createOptionBtnGroup([
      { label: "Find", id:"$find", click: this.find.bind(this) },
    ]));
    find.appendChild(group);

    var filter = document.createElement('div');
    filter.className = "searchinfiles-filter";
    filter.appendChild(this.createInput({ id: "$filter", placeholder: "Filter with..." }));

    var replace = document.createElement('div');
    replace.className = "searchinfiles-replace";
    group = document.createElement('div');
    group.className = "input-group";
    group.appendChild(this.createOptionBtnGroup([
      { label: "AA", tooltip: "Preserve case", id:"$pcase" }
    ]));
    group.appendChild(this.createInput({ id: "$replacement", placeholder: "Replace with..." }));
    group.appendChild(this.createOptionBtnGroup([
      { label: "Replace", id:"$replace", click: this.replace.bind(this) },
    ]));
    replace.appendChild(group);

    this.editor = new EditorView.SimpleEditorView();
    this.editor.editor.getSession().setMode('ace/mode/c9search');
    (<any>this.editor.editor).on("dblclick", (e) => {
      var editor = e.editor;
      var session = editor.getSession();
      var pos = editor.getCursorPosition();
      var token = session.getTokenAt(pos.row, 0);
      if (token && token.type === "c9searchresults.constant.numeric") {
        var pathrow = parseInt(token.value);
        var indent = token.value.length + 2;
        var pathcol = 0;
        token = session.getTokenAt(pos.row, pos.column);
        if (token && token.type === "c9searchresults.keyword")
          pathcol = token.start - indent;
        var path = null;
        for (var prow = pos.row; !path && prow >= 0; prow--) {
          var token = session.getTokenAt(prow, 0)
          if (token && token.type === "string")
            path = token.value;
        }
        if (path && pathrow) {
          setTimeout(() => {
            core.async.run(null, [
              (p) => { core.globals.ide.openFile(p, path); },
              (p) => {
                var ed = p.context.view && p.context.view.editor;
                if (ed)
                  setTimeout(() => { ed.gotoLine(pathrow, pathcol, true); }, 0);
                p.continue();
              }
            ])
          }, 0);
        }
      }
    });

    this.el.appendChild(find);
    this.el.appendChild(filter);
    this.el.appendChild(replace);
    this.el.appendChild(this.editor.el);
    this.contextsize = 2;
    core.menu.bindContextMenuTo(this.$ctx, () => {
      return [1,2,3,4,5].map((s) => {
        return {
          label: "Context size: " + s,
          type: "radio",
          checked: s == this.contextsize,
          click: () => { this.contextsize = s; }
        }
      });
    });
  }

  focus() {
    this.$search.focus();
    super.focus();
  }

  destroy() {
    this.editor.destroy();
    super.destroy();
  }

  resize() {
    this.editor.resize();
    super.resize();
  }

  isViewFor() {
    return true;
  }

  find() {
    this._findOrReplace(false);
  }

  replace() {
    this._findOrReplace(true);
  }

  _findOrReplace(replace) {
    core.async.run(null, [
      (p) => {
        var options = this.options();
        var opts = [];
        if (options.regexp) opts.push("regex");
        if (options.casesensitive) opts.push("case sensitive");
        if (options.wholeword) opts.push("whole word");
        if (options.showcontext) opts.push("context");
        var result = "Searching for " + options.searchtext + " inworkspaces files" + opts.join(', ') + "\n\n";
        this.setResults(result);
        core.globals.ide[replace ? "replace" : "find"](p, this.options());
      },
      (p) => {
        if (p.context.result && p.context.result.search) {
          this.setResults(p.context.result.search);
          if (replace && p.context.result.replacements) {
            var replacements = p.context.result.replacements;
            replacements.forEach((r) => {
              core.async.run(null, [
                (p) => { core.globals.ide.openFile(p, r.path); },
                (p) => {
                  var ed: AceAjax.Editor = p.context.view && p.context.view.editor;
                  var session: AceAjax.IEditSession = ed.getSession();
                  if (ed) {
                    for(var i = r.replacements.length; i > 0;) {
                      var replacement = r.replacements[--i];
                      var range = new EditorView.Range(replacement.row, replacement.col, replacement.row, replacement.col + replacement.length);
                      session.replace(range, replacement.text);
                    }
                  }
                  p.continue();
                }
              ])
            });
          }
        }
      }
    ]);
  }

  setResults(results: string) {
    this.editor.editor.setValue(results ? results : "");
    this.editor.editor.navigateTo(0, 0);
    this.editor.editor.focus();
  }

  options() {
    return {
      regexp       : $(this.$rx).hasClass('active'),
      casesensitive: $(this.$cs).hasClass('active'),
      wholeword    : $(this.$ww).hasClass('active'),
      showcontext  : $(this.$ctx).hasClass('active') ? this.contextsize : 0,
      searchtext   : $(this.$search).val(),
      filter       : $(this.$filter).val(),
      preservecase : $(this.$pcase).hasClass('active'),
      replacement  : $(this.$replacement).val(),
    }
  }

  _reloadOptions() {

  }

  createOptionBtnGroup(btns: { label: string, tooltip?: string, id: string, click?: any }[]) {
    var group = document.createElement("div");
    btns.forEach((btn) => {
      group.appendChild(this.createOptionBtn(btn));
    });
    group.className = "input-group-btn";
    return group;
  }
  createInput(opt: { placeholder: string, id: string }) {
    var el = document.createElement('input');
    el.className= "form-control";
    el.placeholder = opt.placeholder;
    this[opt.id] = el;
    return el;
  }
  createOptionBtn(btn: { label: string, tooltip?: string, id: string, click?: any }) {
    var el = document.createElement("button");
    el.className = "btn btn-default";
    el.textContent = btn.label;
    el.title = btn.tooltip;
    this[btn.id] = el;
    el.addEventListener('click', btn.click ? btn.click : (e) => {
      $(el).toggleClass('active');
      this._reloadOptions();
      el.blur();
    });
    return el;
  }

}

SearchInFiles.prototype.duplicate = function() {
  return new SearchInFiles();
}

export = SearchInFiles;
