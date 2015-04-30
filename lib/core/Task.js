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
function Task()
{
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
 * @callback Task~callback
 * @param {[Error]|Error|null} errors
 */
/**
 * Run the task
 * @param {Runner} runner
 * @param {Task~callback} callback
 */
Task.prototype.run = function(runner, callback) {
  callback();
};

/**
 * Clean the task
 * @param {Runner} runner
 * @param {Task~callback} callback
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

function Graph(inputs, outputs) {
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

Graph.prototype._run = function (fct, runner, callback) {
  var self = this;

  function setWaiting(tasks) {
    tasks.forEach(function(input) {
      input.state = State.WAITING;
      input.observers = [];
      input.requirements = input.dependencies.length;
      setWaiting(input.requiredBy);
    });
  }
  setWaiting(this.inputs);

  var allErrors = [];
  var barrier = new Barrier.Simple();

  function run(task) {
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
              if (--next.requirements === 0) {
                run(next);
              }
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
