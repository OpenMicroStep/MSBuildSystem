var util = require('util');
var debug = 0;

function Barrier(nb, action)
{
  this.counter = nb || 0;
  this.action = action;
  if(debug) {
    var self = this;
    this.steps = [new Error("new" + self.counter).stack];
    this.to = setTimeout(function() {
      console.error("Barrier not unlocked (counter="+self.counter+")");
      self.steps.forEach(function(step) { console.error(step); });
    }, debug);
  }

}

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

Barrier.prototype.inc = function() {
  this.counter++;
  if(debug) this.steps.push(new Error("inc " + this.counter).stack);
};

Barrier.prototype.dec = function (err) {
  if(err) {
    this.counter = 0;
    this.action(err);
  }
  else if(--this.counter === 0) {
    this.signal(err);
  }
  if(debug) this.steps.push(new Error("dec " + this.counter).stack);
};

Barrier.prototype.signal = function() {
  if(this.action)
    this.action.apply(null, arguments);
  if(this.to)
    clearTimeout(this.to);
};


Barrier.prototype.waitOn = function(action) {
  var self = this;
  self.inc();
  return function() {
    if(action) action.apply(null, arguments);
    self.dec.apply(self, arguments);
  }
};

Barrier.prototype.endWith = function(action) {
  if(debug) this.steps.push(new Error("endWith " + this.counter).stack);
  this.action = action;
  if(this.counter <= 0)
    this.signal();
};

function StoreBarrier(nb, action) {
  Barrier.apply(this, arguments);
  this.errors = [];
}
util.inherits(StoreBarrier, Barrier);

StoreBarrier.prototype.dec = function (err) {
  if(err) this.errors.push(err);
  if(--this.counter === 0)
    this.signal();
};

StoreBarrier.prototype.signal = function() {
  if(this.action)
    this.action(this.errors);
};

function IgnoreBarrier(nb, action) {
  Barrier.apply(this, arguments);
}
util.inherits(StoreBarrier, Barrier);

IgnoreBarrier.prototype.dec = function (err) {
  if(--this.counter === 0)
    this.signal();
};

IgnoreBarrier.prototype.signal = function() {
  if(this.action)
    this.action();
};

module.exports = {
  createSimpleCb: Barrier.createSimpleCb,
  Simple: Barrier,
  Store: StoreBarrier,
  Ignore: IgnoreBarrier
};