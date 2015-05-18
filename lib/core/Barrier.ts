/// <reference path="../../typings/tsd.d.ts" />
/* @flow */

class Barrier {
  protected actions:((...args) => any)[];
  protected counter: number;

  constructor(public name: string, counter: number = 0) {
    this.reset(counter);
  }

  reset(counter: number) {
    this.actions = [];
    this.counter = counter;
  }

  inc() {
    this.counter++;
  }

  dec() {
    if(--this.counter === 0) {
      this.signal();
    }
  }
  protected signal() {
    this.actions.forEach(function(action) {
      action();
    });
  }
  decCallback() {
    return () => { this.dec(); }
  }
  waitOn(action?: (...args) => any) {
    this.inc();
    var _this = this;
    return function() {
      if(action) action.apply(null, arguments);
      _this.dec();
    }
  }

  endWith(action: () => any) {
    if(this.counter <= 0)
      action();
    else
      this.actions.push(action);
  }
}

module Barrier {

  export class FirstErrBarrier extends Barrier {
    protected err = null;
    dec(err?: any) {
      if(err && this.counter > 0) {
        this.err = err;
        this.counter = 1;
      }
      super.dec();
    }
    protected signal() {
      this.actions.forEach(function(action) {
        action(this.err);
      });
    }
    endWith(action: (err) => any) {
      if(this.counter <= 0)
        action(this.err);
      else
        this.actions.push(action);
    }
  }

}

export = Barrier;
