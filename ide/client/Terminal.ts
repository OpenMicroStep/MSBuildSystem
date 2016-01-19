import {globals, events, replication, async} from '../core';

class Terminal extends replication.DistantObject {
  path: string;
  args: string[];

  constructor() {
    super();
  }

  initWithData(data) {
    this.path = data.path;
    this.args = data.args;
  }


  outofsync(p) {
    this._emit("exit", { disconnect: 1 });
    p.continue();
  }

  resize(p, rows, cols) {
    this.remoteCall(p, "resize", rows, cols);
  }

  spawn(p) {
    this.remoteCall(p, "spawn");
  }
  write(p, data) {
    this.remoteCall(p, "write", data);
  }
  kill(p) {
    this.remoteCall(p, "kill");
  }
}
replication.registerClass("Terminal", Terminal);

export = Terminal;

