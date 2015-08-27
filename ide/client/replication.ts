/// <reference path="../../typings/browser.d.ts" />
"use strict";

import io = require('socket.io-client');

// The socket is globally shared to ease the replication system
export var socket: SocketIOClient.Socket = io.connect({ transports: ['websocket'] });


export interface DistantObjectProtocol {
  cls: string;
  id: string;
  data: any;
}


var instances: {[s: string]: any} = {};
var classes: {[s: string]: any} = {};
export function registerClass(cls: string, ctor) {
  classes[cls] = ctor;
}
socket.on("repevt", function(id: string, evt: string, ...args) {
  var inst = instances[id];
  if (inst) {
    if (typeof inst[evt] === "function") {
      inst[evt](...args);
    }
    else {
      console.error("No method '"+evt+"' on ", inst);
    }
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

export class DistantObject {
  id: string;

  constructor() {
  }

  changeId(newId: string) {
    delete instances[this.id];
    instances[newId] = this;
    this.id = newId;
  }

  initWithData(data:any):void {
    for(var name of Object.getOwnPropertyNames(data)) {
      this[name] = data[name];
    }
  }

  outofsync() : Promise<any> { return new Promise(function(resolve) { resolve() ; }); }

  private _replicate(type: string, ...args) : Promise<any> {
    return new Promise((resolve, reject) => {
      socket.emit(type, this.id, ...args, (err, res) => {
        if (err == 404) {
          this.outofsync().then(() => {
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
