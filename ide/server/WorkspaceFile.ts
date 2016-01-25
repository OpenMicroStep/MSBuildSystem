import path = require('path');
import replication = require('./replication');
import File = require('../../buildsystem/core/File');

class WorkspaceFile extends replication.ServedObject<File> {
  constructor(path: string) {
    super(File.getShared(path));
  }
  lines: string[];
  version: number;
  deltas: any[];

  data() : any {
    return {
      path:this.obj.path,
      name:this.obj.name,
      extension:this.obj.extension,
      content:this.lines.join("\n"),
      deltas: this.deltas,
      version:this.version,
    };
  }

  getLastVersion() {
    return this.lines.join('\n');
  }

  change(p, e) {
    if (e && Array.isArray(e.deltas)) {
      for(var i= 0, len = e.deltas.length; i < len; ++i) {
        this.applyDelta(e.deltas[i]);
      }
      this.deltas.push(...e.deltas);
      this.version += e.deltas.length;
      this.broadcastToOthers(p.context.socket, "extchange", { version: this.version, deltas:e.deltas });
      p.context.response = { version: this.version };
    }
    p.continue();
  }

  applyDelta(delta) {
    //
    var docLines = this.lines;
    var row = delta.start.row;
    var startColumn = delta.start.column;
    var line = docLines[row] || "";
    switch (delta.action) {
      case "insert":
        var lines = delta.lines;
        if (lines.length === 1) {
            docLines[row] = line.substring(0, startColumn) + delta.lines[0] + line.substring(startColumn);
        } else {
            var args = [row, 1].concat(delta.lines);
            docLines.splice.apply(docLines, args);
            docLines[row] = line.substring(0, startColumn) + docLines[row];
            docLines[row + delta.lines.length - 1] += line.substring(startColumn);
        }
        break;
      case "remove":
        var endColumn = delta.end.column;
        var endRow = delta.end.row;
        if (row === endRow) {
            docLines[row] = line.substring(0, startColumn) + line.substring(endColumn);
        } else {
            docLines.splice(
                row, endRow - row + 1,
                line.substring(0, startColumn) + docLines[endRow].substring(endColumn)
            );
        }
        break;
      default:
        console.warn("Unsupported delta action", delta);
        break;
    }
}

  save(p, content: string) {
    var version = ++this.version;
    this.lines = content.split(/\r\n|\r|\n/);
    this.deltas = [];
    this.obj.writeUtf8File(content, (err) => {
      if (!err) {
        this.broadcastToOthers(p.context.socket, "extsaved", { version: version, content: content });
        p.context.response = { version: version };
      }
      p.context.error = err;
      p.continue();
    });
  }

  static files: Map<string, WorkspaceFile> = new Map<any, any>();
  static getShared(pool, filePath) {
    filePath = path.normalize(filePath);
    if(!path.isAbsolute(filePath)) {
      pool.context.error =  "'filePath' must be absolute (filePath=" + filePath + ")";
      pool.continue();
      return;
    }

    var file = WorkspaceFile.files.get(filePath);
    if(!file) {
      WorkspaceFile.files.set(filePath, file = new WorkspaceFile(filePath));
      file.obj.readUtf8File(function (err, content) {
        if (err) pool.context.error = err;
        else {
          file.lines = content.split(/\r\n|\r|\n/);
          file.version = 0;
          file.deltas = [];
          pool.context.response = file;
        }
        pool.continue();
      });
    }
    else {
      pool.context.response = file;
      pool.continue();
    }
  }
}

export = WorkspaceFile;
