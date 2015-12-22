/// <reference path="../../typings/browser.d.ts" />
"use strict";

import io = require('socket.io-client');
import events = require('./events');

// The socket is globally shared to ease the replication system
export var socket: SocketIOClient.Socket = io.connect('http://127.0.0.1:3000', { transports: ['websocket'] });


export interface DistantObjectProtocol {
  cls: string;
  id: string;
  data: any;
}


var instances: {[s: string]: DistantObject} = {};
var classes: {[s: string]: any} = {};
export function registerClass(cls: string, ctor) {
  classes[cls] = ctor;
}
socket.on("repevt", function(id: string, evt: string, e: any) {
  var inst = instances[id];
  if (inst) {
    console.log("repevt", evt, e);
    inst._emit(evt, e);
  }
  else {
    console.error("No object with id ", id);
  }
});

function decode(d) {
  if (d.cls && d.id && classes[d.cls]) {
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

export class DistantObject implements events.EventEmitter {
  _emit: (eventName: string, e) => any;
  _signal: (eventName: string, e) => void;
  once: (eventName: string, callback: (e, emitter) => any) => void;
  on: (eventName: string, callback: (e, emitter) => any) => void;
  off: (eventName: string, callback: (e, emitter) => any) => void;

  id: string;
  private _outofsync: Promise<any>;

  constructor() {
    this._outofsync = null;
  }

  changeId(newId: string) {
    var instance = instances[this.id];
    if (instance)
      instance.destroy();
    instances[newId] = this;
    this.id = newId;
  }

  destroy() {
    this._replicate("destroy");
    delete instances[this.id];
  }

  initWithData(data:any):void {
    if (!data) return;
    for(var name of Object.getOwnPropertyNames(data)) {
      this[name] = data[name];
    }
  }

  outofsync() : Promise<any> { return new Promise(function(resolve) { resolve() ; }); }

  private _replicate(type: string, ...args) : Promise<any> {
    return new Promise((resolve, reject) => {
      socket.emit(type, this.id, ...args, (err, res) => {
        if (err == 404) {
          if (!this._outofsync) {
            this._outofsync = this.outofsync();
            this._outofsync.then(() => {
              this._outofsync = null;
            });
          }
          this._outofsync.then(() => {
            socket.emit(type, this.id, ...args, (err, res) => {
              if (err) reject(err);
              else resolve(decode(res));
            });
          }, reject);
        }
        else if (err) reject(err);
        else resolve(decode(res));
      });
    });
  }

  remoteCall(fn: string, ...args) : Promise<any> {
    return this._replicate("repcall", fn,  ...args);
  }

  getProperty(name: string) : Promise<any> {
    return this._replicate("repget", name);
  }

  setProperty(name: string, value) : Promise<any> {
    return this._replicate("repset", name, value);
  }
}
events.mixin(DistantObject);
