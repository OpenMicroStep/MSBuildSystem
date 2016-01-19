import async = require('../core/async');
import io = require('socket.io');
import Socket = SocketIO.Socket;
var MSTools = require('MSTools');

enum Replication {
  SERVERTOCLIENT = 0x1,
  CLIENTTOSERVER = 0x2,
  OBJECT = 0x3,
}

type ReplicationInfo = { name: string, type: Replication };
type SocketInfo = {
  socket: Socket,
  replicatedObjects: Set<ServedObject<any>>,
  _repcall?: any, _destroy?: any, _error?: any, _close?: any
};

export function registerSocket(socket: Socket) : SocketInfo {
  var info: SocketInfo = { socket: socket, replicatedObjects: new Set<ServedObject<any>>() };
  socket.on('repcall', info._repcall = function(id, fn, _args, _cb) {
    var cb = arguments[arguments.length - 1];
    var o = objectWithId(id);
    if (o) {
      if (!info.replicatedObjects.has(o)) {
        o.addListener(info);
        info.socket.emit('reprec', o.id, o.reconnectData());
      }
      var args= [];
      for(var i = 2, end = arguments.length - 1; i < end; ++i) {
        args.push(arguments[i]);
      }
      o.handleCall(info, cb, fn, args);
    }
    else cb(404);
  });
  socket.on('destroy', info._destroy = function(id) {
    var o = objectWithId(id);
    if (o)
      o.removeListener(info);
  });
  socket.on('error', info._error = function(err) {
    console.warn("Error on socket", err, err.stack);
    unregisterSocket(info);
  });
  socket.on('disconnect', info._close = function() {
    unregisterSocket(info);
  });
  return info;
}
export function unregisterSocket(info: SocketInfo) {
  info.replicatedObjects.forEach(function(obj) {
    obj.removeListener(info);
  });
  info.socket.removeListener('destroy', info._destroy);
  info.socket.removeListener('repcall', info._repcall);
  info.socket.removeListener('error', info._error);
  info.socket.removeListener('close', info._close);
}

var ids = {};

export function registerObject(o: ServedObject<any>) {
  ids[o.id] = o;
}
export function unregisterObject(o: ServedObject<any>) {
  delete ids[o.id];
}
export function objectWithId(id: string) : ServedObject<any> {
  return ids[id];
}

export function encode(info: SocketInfo, r) {
  if (r instanceof ServedObject) {
    if (!info.replicatedObjects.has(r))
      r.addListener(info);
    r= r.encode();
  }
  return r;
}

export class ServedObject<T> {
  static counter = (new Date()).getTime();

  listeners: Set<Socket>;
  obj: T;
  id: string;

  constructor(obj: T) {
    this.id= this.constructor.name + "-" + (++ServedObject.counter);
    this.listeners = new Set<Socket>();
    this.obj = obj;
  }

  register() {
    registerObject(this);
  }
  unregister() {
    unregisterObject(this);
  }

  addListener(info: SocketInfo) {
    if (this.listeners.size === 0)
      this.register();
    this.listeners.add(info.socket);
    info.replicatedObjects.add(this);
  }
  removeListener(info: SocketInfo) {
    this.listeners.delete(info.socket);
    info.replicatedObjects.delete(this);
    if (this.listeners.size === 0)
      this.unregister();
  }

  broadcast(evt: string, e?: any) {
    this.listeners.forEach((socket) => {
      this.emit(socket, evt, e);
    });
  }
  broadcastToOthers(socket: Socket, evt, e?: any) {
    this.listeners.forEach((s) => {
      if (s !== socket)
        this.emit(s, evt, e);
    });
  }
  emit(socket: Socket, evt, e?: any) {
    socket.emit("repevt", this.id, evt, e);
  }

  encode() : any {
    return { cls: this.constructor.name, id: this.id, data: this.data() };
  }

  reconnect(p) { p.context.response = true; p.continue(); }
  reconnectData() : any {
    return this.data();
  }
  data() : any {
    return null;
  }

  handleCall(socket: SocketInfo, cb: (err: any, ret?: any) => any, fn: string, args: any[]) {
    var f = this[fn];
    if (typeof f !== "function")
      return cb({ code: "missingfn", msg: fn + " is not a function", args: [fn] });
    var pool = new async.Async({ socket: socket.socket }, [
      (p) => {
        args.unshift(p);
        f.apply(this, args);
      },
      (p) => {
        if (p.context.response !== void 0)
          cb(null, encode(socket, p.context.response));
        else
          cb(p.context.error || { code: "unknown", msg: "unknown error" });
      }
    ]);
    pool.continue();
  }

  static setupReplication(ctor, replicates: ReplicationInfo[]) {
    replicates.forEach(function(replicate) {
      var name = replicate.name;
      var priv = "_" + name;
      Object.defineProperty(ctor.prototype, name, {
        get: function () {
          return this.getProperty(name);
        },
        set: function (value) {
          return this.setProperty(name);
        },
        enumerable: true,
        configurable: true
      });
    });
  }
}

