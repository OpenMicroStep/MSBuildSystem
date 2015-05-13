/* @flow weak */
var util = require('util');
var _ = require('underscore');
var debugTimeOut = 0;

var AbstractBarrier = function(nb, action) {
  this.counter = nb || 0;
  this.action = action || null;
  this.signalArgs = null;
};

AbstractBarrier.prototype.inc = function() {
  this.counter++;
};

AbstractBarrier.prototype.dec = function (err) {
  if(--this.counter === 0 && this.signalArgs === null) {
    this.signal.apply(this, arguments);
  }
};

AbstractBarrier.prototype.waitOn = function(action) {
  var self = this;
  self.inc();
  return function() {
    if(action) action.apply(null, arguments);
    self.dec.apply(self, arguments);
  }
};

AbstractBarrier.prototype.signal = function() {
  this.signalArgs = _.toArray(arguments);
  if(this.action)
    this.action.apply(null, this.signalArgs);
};

AbstractBarrier.prototype.endWith = function(action) {
  this.action = action;
  if(this.counter === 0)
    this.action.apply(this, this.signalArgs || []);
};

AbstractBarrier.prototype.reset = function(action) {
  this.counter = 0;
  this.signalArgs = null;
};

if(debugTimeOut) {
  var DebugBarrierParent = AbstractBarrier;
  var DebugBarrier = AbstractBarrier = function(nb, action) {
    DebugBarrierParent.apply(this, arguments);
    var self = this;
    this.steps = [new Error("new" + self.counter).stack];
    this.to = setTimeout(function() {
      console.error("Barrier not unlocked (counter="+self.counter+")");
      self.steps.forEach(function(step) { console.error(step); });
    }, debugTimeOut);
  };

  util.inherits(DebugBarrier, DebugBarrierParent);

  DebugBarrier.prototype.inc = function() {
    DebugBarrierParent.prototype.inc.apply(this, arguments);
    this.steps.push(new Error("inc " + this.counter).stack);
  };

  DebugBarrier.prototype.dec = function () {
    DebugBarrierParent.prototype.dec.apply(this, arguments);
    this.steps.push(new Error("dec " + this.counter).stack);
  };

  DebugBarrier.prototype.signal = function() {
    DebugBarrierParent.prototype.signal.apply(this, arguments);
    if(this.to) {
      clearTimeout(this.to);
      this.to = null;
    }
  };

  DebugBarrier.prototype.endWith = function(action) {
    this.steps.push(new Error("endWith " + this.counter).stack);
    DebugBarrierParent.prototype.endWith.apply(this, arguments);
  };
}


/**
 *
 * @param nb
 * @param action
 * @constructor
 */
function Barrier(nb, action)
{
  AbstractBarrier.apply(this, arguments);
}

util.inherits(Barrier, AbstractBarrier);

Barrier.createSimpleCb = function(nb, action) {
  if(typeof nb !== "number" || nb < 0)
    throw "nb must be a positive number";
  if(typeof action !== "function")
    throw "action must be a function";
  var barrier = new Barrier(nb, action);
  return function (err) {
    barrier.dec(err);
  }
};

Barrier.prototype.dec = function (err) {
  if(err) this.signal(err);
  AbstractBarrier.prototype.dec.apply(this, arguments);
};

/**
 *
 * @param nb
 * @param action
 * @constructor
 */
function StoreBarrier(nb, action) {
  AbstractBarrier.apply(this, arguments);
  this.errors = [];
}
util.inherits(StoreBarrier, AbstractBarrier);

StoreBarrier.prototype.dec = function (err) {
  if(err) this.errors.push(err);
  AbstractBarrier.prototype.dec.apply(this, arguments);
};

StoreBarrier.prototype.signal = function() {
  AbstractBarrier.prototype.signal.call(this, this.errors);
};

/**
 *
 * @param nb
 * @param action
 * @constructor
 */
function IgnoreBarrier(nb, action) {
  AbstractBarrier.apply(this, arguments);
}
util.inherits(StoreBarrier, AbstractBarrier);

IgnoreBarrier.prototype.signal = function() {
  AbstractBarrier.prototype.signal.call(this);
};

/**
 * @type {{createSimpleCb: (Function|*), Simple: Barrier, Store: StoreBarrier, Ignore: IgnoreBarrier}}
 */
module.exports = {
  createSimpleCb: Barrier.createSimpleCb,
  Simple: Barrier,
  Store: StoreBarrier,
  Ignore: IgnoreBarrier
};