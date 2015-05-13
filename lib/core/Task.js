/* @flow weak */
var Barrier = require('./Barrier');
var util = require('util');

/**
 * @readonly
 * @enum {number}
 */
var State = {
  WAITING:0,
  RUNNING:1,
  DONE:2
};


var __id_counter = 0;

/**
 * @constructor
 */
function Task(name)
{
  if(typeof name !== "string") throw "not a string";
  this.name = name || "";

  this._id = ++__id_counter;
  /**
   * Current state of the Task
   * This value is managed by Task.Graph
   * @type {State}
   */
  this.state = State.WAITING;

  this.observers = [];

  /**
   * List of errors that occurred at the last run
   * This value is managed by Task.Graph
   * @type {Array}
   */
  this.errors = [];

  /**
   * Number of unmet task requirements to be able to run this task.
   * This value is managed by Task.Graph
   * @type {number}
   */
  this.requirements = 0;


  /**
   * List of tasks this task depends on.
   * @type {Array}
   */
  this.dependencies = [];

  /**
   * List of tasks that depends on this one
   * @type {Array}
   */
  this.requiredBy = [];
}

Task.prototype.addDependencies = function(tasks) {
  var self = this;
  tasks.forEach(function(task) { self.addDependency(task); });
};

Task.prototype.addDependency = function(task) {
  if(this.dependencies.indexOf(task) === -1) {
    this.dependencies.push(task);
    task.requiredBy.push(this);
  }
};

/**
 * @callback Task~runCallback
 * @param {[Error]|Error|null} errors
 */

/**
 * @callback Task~isRunRequiredCallback
 * @param {[Error]|Error|null} errors
 */

/**
 * @param {Runner} runner
 * @param {Task~isRunRequiredCallback} callback
 */
Task.prototype.isRunRequired = function(runner, callback) {
  callback(null, true);
};

/**
 * Run the task if required
 * @param {Runner} runner
 * @param {Task~runCallback} callback
 */
Task.prototype.runIfRequired = function(runner, callback) {
  var self = this;
  self.isRunRequired(runner, function(err, required) {
    if(err) return callback(err);
    if(!required) return callback();
    else self.run(runner, callback);
  })
};

/**
 * Run the task
 * @param {Runner} runner
 * @param {Task~runCallback} callback
 */
Task.prototype.run = function(runner, callback) {
  callback();
};

/**
 * Clean the task
 * @param {Runner} runner
 * @param {Task~runCallback} callback
 */
Task.prototype.clean = function(runner, callback) {
  callback();
};

function Runner()
{

}
Runner.prototype.info = function() {
  console.info.apply(console, arguments);
};

/**
 * @param {string} name
 * @param {[Task]} inputs
 * @param {[Task]} outputs
 * @constructor
 */
function Graph(name, inputs, outputs) {
  Task.call(this, name);

  if(!_.isArray(inputs)) throw "Inputs must be an array";
  if(!_.isArray(outputs)) throw "Inputs must be an array";
  /**
   * List of tasks set as inputs of the graph
   * @type {Array}
   */
  this.inputs = inputs || [];

  /**
   * List of tasks set as outputs of the graph
   * @type {Array}
   */
  this.outputs = outputs || [];
}

util.inherits(Graph, Task);

function log(level) {
  while(level-- > 0) {
    process.stdout.write('  ');
  }
  var args = _.toArray(arguments);
  args.shift();
  console.log.apply(console.log, args);
}

Task.prototype.debugPrint = function(level) {
  log(level, "-", this.name);
};

Graph.prototype.debugPrint = function(level) {
  level = level || 0;
  log(level, '+', this.name);
  var tasks = [];
  function iterate(inputs) {
    tasks.push.apply(tasks, inputs);
    inputs.forEach(function(input) { iterate(input.requiredBy); });
  }
  iterate(this.inputs);
  tasks = _.unique(tasks);
  tasks.forEach(function(task) {
    task.debugPrint(level + 1);
  });
};

Task.prototype._setWaiting = function() {
  this.state = State.WAITING;
  this.observers = [];
  this.requirements = this.dependencies.length;
  this.requiredBy.forEach(function(input) {input._setWaiting();});
};

Graph.prototype._setWaiting = function() {
  this.inputs.forEach(function(input) {input._setWaiting();});
  Task.prototype._setWaiting.call(this);
};

Graph.prototype._run = function (fct, runner, callback) {
  console.info("run", this.name);
  var self = this;

  this._setWaiting();

  var allErrors = [];
  var barrier = new Barrier.Simple();

  function run(task) {
    if (task.requirements !== 0) return;

    barrier.inc();
    var cb = function(errors) {
      if(errors.length) {
        console.warn("Errors", errors);
        allErrors.push.apply(allErrors, errors);
      }
      barrier.dec();
    };

    if (task.state === State.DONE) {
      cb(task.errors);
    }
    else {
      task.observers.push(cb);
      if(task.state !== State.RUNNING) {
        task.state = State.RUNNING;
        task[fct](runner, function(errors) {
          if (!errors) errors = [];
          else if (!Array.isArray(errors)) errors = [errors];
          task.errors = errors;
          task.state = State.DONE;
          if (!task.errors.length) {
            task.requiredBy.forEach(function (next) {
              next.requirements--;
              run(next);
            });
          }
          task.observers.forEach(function(observer) { observer(task.errors); });
          task.observers = [];
        });
      }
    }
  }

  this.inputs.forEach(run);
  barrier.endWith(function() {
    callback(allErrors.length);
  });
};

Graph.prototype.run = function (runner, callback) {
  this._run("run", runner, callback);
};

Graph.prototype.clean = function (runner, callback) {
  this._run("clean", runner, callback);
};

Task.Runner = Runner;
Task.Graph = Graph;
Task.State = State;
module.exports = Task;
