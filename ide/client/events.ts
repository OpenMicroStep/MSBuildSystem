/// <reference path="../../typings/browser.d.ts" />
"use strict";

function applyMixins(derivedCtor: any, baseCtors: any[]) {
  baseCtors.forEach(baseCtor => {
    Object.getOwnPropertyNames(baseCtor.prototype).forEach(name => {
      derivedCtor.prototype[name] = baseCtor.prototype[name];
    })
  });
}

var aceEventEmitter = ace.require("ace/lib/event_emitter").EventEmitter;
export class EventEmitter {
  _emit: (eventName: string, e) => any;
  _signal: (eventName: string, e) => void;
  once: (eventName: string, callback: (e, emitter) => any) => void;
  on: (eventName: string, callback: (e, emitter) => any) => void;
  off: (eventName: string, callback: (e, emitter) => any) => void;
}
applyMixins(EventEmitter, [{ prototype: aceEventEmitter }]);

export function mixin(ctor) {
  applyMixins(ctor, [EventEmitter]);
}
