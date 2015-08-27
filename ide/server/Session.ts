/// <reference path="../../typings/tsd.d.ts" />
'use strict';

enum Replication {
  SERVERTOCLIENT = 0x1,
  CLIENTTOSERVER = 0x2,
  OBJECT = 0x3,
}

type ReplicationInfo = { name: string, type: Replication };

class Remote {
  static counter = 0;
  id: string;
  constructor(public socket: SocketIO.Socket) {
    this.id= this.constructor.name + "-" + (++Remote.counter);
  }
  replicate(attr, value) {
    this.socket.emit('replicate', this.id, value);
  }
  static setupReplication(ctor, replicates: ReplicationInfo[]) {
    replicates.forEach(function(replicate) {
      var name = replicate.name;
      var priv = "_" + name;
      Object.defineProperty(ctor.prototype, name, {
        get: function () {
          return this[priv];
        },
        set: function (value) {
          this[priv] = value;
          this.replicate(name, value);
        },
        enumerable: true,
        configurable: true
      });
    });
  }
}

class Session extends Remote {
  constructor(socket: SocketIO.Socket) {
    super(socket);
  }
  workspace;
}

Remote.setupReplication(Session, [
  { name: 'workspace', type: Replication.OBJECT }
]);

export = Session;