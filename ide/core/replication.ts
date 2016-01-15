/// <reference path="../../typings/browser.d.ts" />

import io = require('socket.io-client');
import events = require('./events');
import async = require('./async');
import Async = async.Async;

// The socket is globally shared to ease the replication system
export var socket: SocketIOClient.Socket = io.connect('http://127.0.0.1:3000', { transports: ['websocket'] });

(<any>window)._socket = socket;

export interface DistantObjectProtocol {
  cls: string;
  id: string;
  data: any;
}

interface Flux<T> extends Async {
  context: { result: T; error: any; };
}

var instances: {[s: string]: DistantObject} = {};
var classes: {[s: string]: any} = {};
export function registerClass(cls: string, ctor) {
  classes[cls] = ctor;
}
socket.on("repevt", function(id: string, evt: string, e: any) {
  var inst = instances[id];
  if (inst) {
    inst._emit(evt, e);
  }
  else {
    console.error("No object with id ", id);
  }
});
socket.on("reprec", function(id: string, data) {
  var inst = instances[id];
  if (inst) {
    inst.reconnect(data);
  }
  else {
    console.error("No object with id ", id);
  }
});
var reconnectPool = new Async(null, (p) => {
  var o: DistantObject = p.context.obj;
  o.remoteCall(p, "reconnect");
});
socket.on('connect', function() {
  for(var k in instances) {
    if (instances.hasOwnProperty(k)) {
      var d: DistantObject= instances[k];
      reconnectPool.continue(null, { obj: d });
    }
  }
});

function decode(d) {
  if (d && d.cls && d.id && classes[d.cls]) {
    var inst = instances[d.id];
    if (!inst) {
      inst = new classes[d.cls];
      inst.id = d.id;
      inst.initWithData(d.data);
      instances[d.id] = inst;
    }
    d = inst;
  }
  return d;
}

var emptyPool = new Async();
export class DistantObject implements events.EventEmitter {
  _emit: (eventName: string, e?) => any;
  _signal: (eventName: string, e?) => void;
  once: (eventName: string, callback: (e, emitter) => any) => void;
  on: (eventName: string, callback: (e, emitter) => any) => void;
  off: (eventName: string, callback: (e, emitter) => any) => void;

  id: string;
  private _outofsync: (p: Async) => void;

  constructor() {
    this.id = null;
    this._outofsync = null;
  }

  changeId(newId: string) {
    var instance = instances[this.id];
    if (instance === this) {
      delete instances[this.id];
    }
    instances[newId] = this;
    this.id = newId;
  }

  destroy() {
    this._signal("destroy", null);
    if (instances[this.id] === this) {
      socket.emit("destroy", this.id);
      delete instances[this.id];
    }
  }

  initWithData(data:any):void {
    if (!data) return;
    for(var name of Object.getOwnPropertyNames(data)) {
      this[name] = data[name];
    }
  }
  reconnect(data) {

  }

  outofsync(p: Async) { p.continue(); }

  private _replicate(p: Async, type: string, ...args) {
    socket.emit(type, this.id, ...args, (err, res) => {
      if (err == 404) {
        if (!this._outofsync) {
          this._outofsync = Async.once([
            this.outofsync.bind(this),
            (p) => { this._outofsync = null; p.continue(); }
          ]);
        }
        p.setFirstElements([
          this._outofsync,
          (p) => {
            socket.emit(type, this.id, ...args, (err, res) => {
              if (err) p.context.error = err;
              else p.context.result = decode(res);
              p.continue();
            });
          }
        ]);
        p.continue();
      }
      else {
        if (err) p.context.error = err;
        else p.context.result = decode(res);
        p.continue();
      }
    });
  }

  remoteCall<T>(p: Async, fn: string, ...args) {
    this._replicate(p, "repcall", fn,  ...args);
  }
}
events.mixin(DistantObject);
