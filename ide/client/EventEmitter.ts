/// <reference path="../../typings/browser.d.ts" />
"use strict";

function applyMixins(derivedCtor: any, baseCtors: any[]) {
  baseCtors.forEach(baseCtor => {
    Object.getOwnPropertyNames(baseCtor.prototype).forEach(name => {
      derivedCtor.prototype[name] = baseCtor.prototype[name];
    })
  });
}

export default class EventEmitter {
  listeners: { [s:string]: ((...args) => any)[] } = {};

  static mixin(ctor) {
    applyMixins(ctor, [EventEmitter]);
  }

  on(event, callme) {
    var listeners = this.listeners[event];
    if (!listeners) {
      listeners = [];
      this.listeners[event] = listeners;
    }
    listeners.push(callme);
  }

  once(event, callmeonce) {
    var self = this;
    var fn = function() {
      callmeonce.apply(this, arguments);
      self.removeListener(event, fn);
    };
    this.on(event, fn);
  }

  emit(event, ...args) {
    var listeners = this.listeners[event];
    if (listeners) {
      for(var listener of listeners) {
        listener(...args);
      }
    }
  }

  removeListener(event, callme) {
    var listeners = this.listeners[event];
    if (listeners) {
      var idx = listeners.indexOf(callme);
      if (idx !== -1) {
        listeners.splice(idx, 1);
      }
    }
  }
}