/* @flow weak */
var Process = require('../core/Process');
var Task = require('../core/Task');
var util = require('util');

function ProcessTask(name) {
  Task.call(this, name);
  this.bin = "echo";
  this.args = [];
}

util.inherits(ProcessTask, Task);

ProcessTask.prototype.appendArgs = function(args) {
  this.args.push.apply(this.args, Array.isArray(args) ? args : arguments);
};

ProcessTask.prototype.prependArgs = function(args) {
  this.args.unshift.apply(this.args, Array.isArray(args) ? args : arguments);
};

ProcessTask.prototype.run = function (runner, callback) {
  Process.run(this.bin, this.args, callback);
};

module.exports = ProcessTask;