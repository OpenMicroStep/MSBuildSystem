/// <reference path="../../typings/tsd.d.ts" />
/* @flow */
import Task = require('./Task');
import Barrier = require('./Barrier');

class Graph extends Task {
  constructor(name:string, public inputs:Set<Task> = new Set<Task>(), public outputs:Set<Task> = new Set<Task>()) {
    super(name);
  }

  reset() {
    this.inputs.forEach((input) => {input.reset();});
    super.reset();
  }
  start(action: Task.Action) {
    console.trace("Run task %s (action=%s)", this.name, Task.Action[action]);
    var barrier = new Barrier("Graph");
    var errors = 0;
    function run(task) {
      if (task.requirements !== 0) return;
      console.trace("Run task %s (action=%s)", task.name, Task.Action[action], task.requirements);

      barrier.inc();
      var cb = function (task: Task) {
        console.trace("End task %s (action=%s)", task.name, Task.Action[action], task.errors, task.requiredBy.size);
        if (task.errors === 0) {
          task.requiredBy.forEach(function (next) {
            next.requirements--;
            run(next);
          });
        }
        else {
          console.warn("Task", task.name, "failed");
          console.warn(task.logs);
          errors += task.errors;
        }
        barrier.dec();
      };

      if (task.state === Task.State.DONE) {
        cb(task);
      }
      else {
        task.observers.push(cb);
        if (task.state !== Task.State.RUNNING) {
          task.state = Task.State.RUNNING;
          task.start(action);
        }
      }
    }

    this.inputs.forEach(run);
    barrier.endWith(() => {
      this.end(errors);
    });
  }

  allTasks(): Set<Task> {
    var tasks = new Set<Task>();
    function iterate(inputs) {
      inputs.forEach(function(input) {
        tasks.add(input);
      });
      inputs.forEach(function(input) {
        iterate(input.requiredBy);
      });
    }
    iterate(this.inputs);
    return tasks;
  }

  toString() {
    return this.name;
  }
  description() {
    console.time("description");
    var desc = "";
    var append = (level: number, prefix: string, d: string) => {
      while(level--) desc += "  ";
      desc += " " + prefix + " " + d + "\n";
    };
    var appendTasks = (level:number, graph: Graph) => {
      append(level, '+', graph.name);
      ++level;
      var tasks = graph.allTasks();
      tasks.forEach((task) => {
        if(task instanceof Graph)
          appendTasks(level, task);
        else
          append(level, '-', task.description());
      });
    };
    appendTasks(0, this);
    console.timeEnd("description");
    return desc;
  }
}

module Graph {
  export class DetachedGraph {
    inputs: Iterable<Task>;
    outputs: Iterable<Task>;
    constructor(inputs: Iterable<Task>, outputs?: Iterable<Task>) {
      this.inputs = inputs;
      this.outputs = outputs || inputs;
    }
    addDependencyOnInputs(task: Task) {
      // In TypeScript 1.6, for of should work
      (<Array<Task>>this.inputs).forEach(function(input) {
        input.addDependency(task);
      });
      this.inputs = [task];
    }
  }
  export interface BuildGraphCallback {
    (err: Error, graph?: DetachedGraph);
  }
}
export = Graph;