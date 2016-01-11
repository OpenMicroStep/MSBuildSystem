/// <reference path="../../typings/tsd.d.ts" />

import Task = require('./Task');
import Barrier = require('./Barrier');
import BuildSession = require('./BuildSession');

class Graph extends Task {
  constructor(name: Task.Name, graph:Graph, public inputs:Set<Task> = new Set<Task>()) {
    super(name, graph);
  }

  reset() {
    this.inputs.forEach((input) => {input.reset();});
    super.reset();
  }
  protected runAction(action: Task.Action) {
    console.trace("Run task %s (action=%s)", this.name, Task.Action[action]);
    var barrier = new Barrier("Graph");
    var errors = 0;
    var self = this;

    function cb(task: Task) {
      console.trace("End task %s %s (action=%s)", task.name.type, task.name.name, Task.Action[action], task.errors, task.requiredBy.size);
      if (task.errors === 0) {
        task.requiredBy.forEach(function (next) {
          next.requirements--;
          run(next);
        });
      }
      else {
        console.debug("Task %s %s failed", task.name.type, task.name.name);
        console.debug(task.logs);
        errors += task.errors;
      }
      barrier.dec();
    }

    function run(task: Task) {
      if (task.requirements !== 0) return;
      console.trace("Run task %s %s (action=%s)", task.name.type, task.name.name, Task.Action[action], task.requirements);

      barrier.inc();
      if (self.enabled === 2 && task.enabled !== 1 && task.enabled !== 2)
        cb(task);
      else
        task.start(action, cb);
    }

    this.inputs.forEach(run);
    barrier.endWith(() => {
      this.end(errors);
    });
  }

  iterate(deep: boolean = false, shouldIContinue?: (task: Task) => boolean) {
    var tasks = new Set<Task>();
    var end = false;
    function iterate(inputs) {
      if (end) return;
      inputs.forEach(function(input) {
        if (!end && !tasks.has(input)) {
          tasks.add(input);
          if (shouldIContinue && !shouldIContinue(input))
            end = true;
          if (deep && input instanceof Graph) {
            iterate(input.inputs);
          }
        }
      });
      inputs.forEach(function(input) {
        iterate(input.requiredBy);
      });
    }
    iterate(this.inputs);
    return tasks;
  }

  allTasks(deep: boolean = false): Set<Task> {
    return this.iterate(deep);
  }

  findTask(deep: boolean, predicate: (task: Task) => boolean) : Task {
    var task = null;
    var ret = predicate(this);
    if (ret === true)
      return this;

    this.iterate(deep, (t) => {
      var ret= !predicate(t);
      if (!ret)
        task = t;
      return ret;
    });
    return task;
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
      append(level, '+', graph.name.type + " " + graph.name.name);
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
  export type Tasks = Iterable<Task>;
  export interface BuildTasksCallback {
    (err: Error, tasks?: Tasks);
  }
}
export = Graph;