import path = require('path');
import fs = require('fs');
import replication = require('./replication');
import WorkspaceFile = require('./WorkspaceFile');
import Workspace = require('./Workspace');
import UserData = require('./UserData');
import async = require('../core/async');
import BuildSystem = require('../../buildsystem/BuildSystem');
import Terminal = require('./Terminal');
import Async = async.Async;

function escapeRegExp(str) {
    return str.replace(/([.*+?^${}()|[\]\/\\])/g, '\\$1');
}

function preservecase(o: string, n: string) : string {
  var i, len, out = "";
  for (i = 0, len = Math.min(o.length, n.length); i < len; ++i) {
    if (o[i] === o[i].toUpperCase())
      out += n[i].toUpperCase();
    else if (o[i] === o[i].toLowerCase())
      out += n[i].toLowerCase();
    else
      out += n[i];
  }
  for (len = n.length; i < n.length; ++i)
    out += n[i];
  return out;
}

class Session extends replication.ServedObject<any> {
  sessionid: string;
  userdata: UserData;

  constructor(sessionid: string) {
    super(null);
    this.sessionid = sessionid;
    this.userdata = new UserData("session-" + sessionid);
  }

  openFile(pool, filepath: string) {
    WorkspaceFile.getShared(pool, filepath);
  }

  openWorkspace(pool, path: string) {
    pool.context.response = Workspace.getShared(path);
    pool.continue();
  }

  _searchOrReplace(p, replace: boolean, options) {
    var set= new Set<string>();
    function iterate(files, directory) {
      for(var i = 0, len = files.length; i < len; ++i) {
        var file = files[i];
        if (file.file)
          set.add(path.join(directory, file.file));
        else if (file.files)
          iterate(file.files, directory);
      }
    }
    for (var w in Workspace.workspaces) {
      var workspace: Workspace = Workspace.workspaces[w];
      iterate(workspace.obj.files, workspace.obj.directory);
    }

    var opts = [];
    if (options.regexp) opts.push("regex");
    if (options.casesensitive) opts.push("case sensitive");
    if (options.wholeword) opts.push("whole word");
    if (options.showcontext) opts.push("context");
    var result = "Searching for " + options.searchtext + " inworkspaces files" + opts.join(', ') + "\n\n";
    var files = Array.from(set);
    var i = 0;
    var context = typeof options.showcontext === "number" ? options.showcontext : 0;
    var searchtext = options.regexp ? options.searchtext : escapeRegExp(options.searchtext);
    if (options.wholeword) searchtext = "\\b" + searchtext + "\\b";
    var rx = new RegExp(searchtext, options.casesensitive ? "g": "gi");
    var replacerx = replace? new RegExp(searchtext, options.casesensitive ? "g": "gi") : null;
    var matches = 0;
    var matchFiles = 0;
    var printline = (pad: string, row: number, line: string, context: boolean) => {
      var r = (row + 1).toString();
      result += pad.substring(0, pad.length - r.length) + r;
      result += (context ? "  " : ": ") + line + "\n";
    }
    var replacementsByPath = replace ? [] : null;
    var parsecontent = (path: string, content: string) => {
      var m, first= true, pad, ctxline, ctxend, last = -1;
      var lines = content.split("\n");
      var replacements = replace ? [] : null;
      for (var i = 0, len = lines.length; i < len; ++i) {
        var line = lines[i];
        var found = false;
        while ((m = rx.exec(line)) !== null) {
          ++matches;
          if (first) {
            ++matchFiles;
            result += path + ":\n";
            pad = "         ".substring(0, Math.max(len.toString().length + 1, 6));
          }
          var start = m.index;
          var end = m.index + m[0].length;
          if (replace) {
            var replacetext = m[0].replace(replacerx, options.replacement);
            if (options.preservecase)
              replacetext = preservecase(m[0], replacetext);
            replacements.push({ row: i, col: start, length: end - start, text: replacetext });
          }

          if (!found) {
            if (context > 0) {
              var ctxstart = Math.max(i - context, last + 1, 0);
              if (last !== -1 && last < ctxstart) {
                for (ctxline= last + 1, ctxend= Math.min(last + context + 1, lines.length, ctxstart); ctxline < ctxend; ++ctxline)
                  printline(pad, ctxline, lines[ctxline], true);
                if (ctxline + 1 === ctxstart)
                  printline(pad, ctxline, lines[ctxline], true);
                else if (ctxline < ctxstart) {
                  var dots = "..........".substring(0, ctxline.toString().length);
                  result += pad.substring(0, pad.length - dots.length) + dots + "\n";
                }
              }
              for (ctxline= ctxstart; ctxline < i; ++ctxline)
                printline(pad, ctxline, lines[ctxline], true);
            }
            printline(pad, i, line, false);
            last = i;
          }
          found = true;
          first = false;
        }
      }
      if (!first) {
        if (context > 0) {
          for (ctxline= last + 1, ctxend= Math.min(last + context + 1, lines.length); ctxline < ctxend; ++ctxline)
            printline(pad, ctxline, lines[ctxline], true);
        }
        result += "\n";
      }
      if (replacements && replacements.length)
        replacementsByPath.push({ path: path, replacements: replacements, regexp: rx });
      next();
    }
    var next = () => {
      if (i < files.length) {
        var file = files[i++];
        var wf = WorkspaceFile.files.get(file);
        if (wf) {
          parsecontent(file, wf.getLastVersion());
        }
        else {
          fs.readFile(file, 'utf8', (err, data) => {
            if (err) next();
            else parsecontent(file, data);
          })
        }
      }
      else {
        result += matches + " matches across " + matchFiles + " files";
        p.context.response = { search: result, replacements: replacementsByPath };
        p.continue();
      }
    }
    next();
  }

  find(p, options) {
    this._searchOrReplace(p, false, options);
  }

  replace(p, options) {
    this._searchOrReplace(p, true, options);
  }

  terminal(p: Async, id) {
    var tty = null;
    if (id === undefined)
      tty = new Terminal("bash", ["-l"]);
    else {
      tty = replication.objectWithId(id);
      if (!(tty instanceof Terminal))
        tty = null;
    }
    p.context.response = tty;
    p.continue();
  }

  userData(p) {
    p.setFirstElements((p) => {
      p.context.response = this.userdata.all();
      p.continue();
    });
    this.userdata.load(p);
  }
  setUserData(p, data: any) {
    this.broadcastToOthers(p.context.socket, "userdata", data);
    this.userdata.data = data;
    this.userdata.save(p);
  }
}

export = Session;