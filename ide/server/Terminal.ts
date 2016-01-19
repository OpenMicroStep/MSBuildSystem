import path = require('path');
import replication = require('./replication');
import child_process = require('child_process');
var pty = require('pty.js');

class Terminal extends replication.ServedObject<any> {
  process: any;
  constructor(public path: string, public args: string[]) {
    super(null);
    this.process = null;
  }

  unregister() {
    if (this.process)
      this.process.kill();
    super.unregister();
  }

  data() : any {
    return {
      path:this.path,
      name:this.args,
    };
  }

  resize(p, cols, rows) {
    if (this.process)
      this.process.resize(cols, rows);
    p.context.response = !!this.process;
    p.continue();
  }

  spawn(p, options) {
    this.process = pty.spawn(this.path, this.args, options);
    this.process.on('data', (chunk) => {
      this.broadcast("data", { chunk: chunk });
    });
    var exited = false;
    var exit = (code, signal, err) => {
      if (!this.process) return;
      this.process = null;
      var res = {code: code, signal: signal, err: err};
      this.broadcast("exit", res);
      p.context.response = res;
      p.continue();
    };
    this.process.on('exit', exit);
    this.process.on('error', exit.bind(-1, null));
  }

  write(p, data) {
    if (this.process)
      this.process.stdin.write(data);
    p.context.response = !!this.process;
    p.continue();
  }

  kill(p) {
    if (this.process)
      this.process.kill();
    p.context.response = !!this.process;
    p.continue();
  }
}

export = Terminal;
