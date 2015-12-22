/// <reference path="../../typings/tsd.d.ts" />
"use strict";

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
  _repget?: any, _repset?: any, _repcall?: any, _destroy?: any, _error?: any, _close?: any
};

export function registerSocket(socket: Socket) : SocketInfo {
  var info: SocketInfo = { socket: socket, replicatedObjects: new Set<ServedObject<any>>() };
  socket.on('repget', info._repget = function(id, name, cb) {
    var o = objectWithId(id);
    if (o) o.handleGetProperty(info, cb, name);
    else cb(404);
  });
  socket.on('repset', info._repset = function(id, name, value, cb) {
    var o = objectWithId(id);
    if (o) o.handleSetProperty(info, cb, name, value);
    else cb(404);
  });
  socket.on('repcall', info._repcall = function(id, fn, args, cb) {
    cb = arguments[arguments.length - 1];
    var o = objectWithId(id);
    if (o) {
      args= [];
      for(var i = 2, end = arguments.length - 1; i < end; ++i) {
        args.push(arguments[i]);
      }
      o.handleCall(info, cb, fn, ...args);
    }
    else cb(404);
  });
  socket.on('destroy', info._destroy = function(id) {
    delete ids[id];
  });
  socket.on('error', info._error = function(err) {
    console.warn("Error on socket", err);
    unregisterSocket(info);
  });
  socket.on('close', info._close = function() {
    unregisterSocket(info);
  });
  return info;
}
export function unregisterSocket(info: SocketInfo) {
  info.replicatedObjects.forEach(function(obj) {
    obj.listeners.delete(info.socket);
    obj.removeListener(info.socket);
    if (obj.listeners.size === 0)
      unregisterObject(obj);
  });
  info.socket.removeListener('repget', info._repget);
  info.socket.removeListener('repset', info._repset);
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
    if (!r.listeners.has(r)) {
      info.replicatedObjects.add(r);
      r.listeners.add(r);
      r.addListener(info.socket);
    }
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
    registerObject(this);
  }

  addListener(socket: Socket) {}
  removeListener(socket: Socket) {}

  broadcast(evt: string, e?: any) {
    this.listeners.forEach((socket) => {
      this.emit(socket, evt, e);
    });
  }
  emit(socket: Socket, evt, e?: any) {
    socket.emit("repevt", this.id, evt, e);
  }

  encode() : any {
    return { cls: this.constructor.name, id: this.id, data: this.data() };
  }
  data() : any {
    return null;
  }

  handleGetProperty(socket: SocketInfo, cb: (err:string, ret?: any) => any, name: string) {
    return cb(null, encode(socket, this[name]));
  }
  handleSetProperty(socket: SocketInfo, cb: (err:string, ret?: any) => any, name: string, value) {
    this[name] = value;
    this.broadcast(name, value);
    cb(null);
  }
  handleCall(socket: SocketInfo, cb: (err:string, ret?: any) => any, fn: string, ...args) {
    if (typeof this[fn] !== "function")
      return cb(fn + " is not a function");
    var ret = this[fn](...args);
    if (ret instanceof Promise) {
      ret.then(function(ret) {
        cb(null, encode(socket, ret));
      }).catch(function(err) {
        cb(err);
      });
    }
    else {
      cb(null, encode(socket, ret));
    }
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

MSTools.defineHiddenConstant(ServedObject.prototype, 'isa', 'ServedObject');

