/// <reference path="../../typings/tsd.d.ts" />
/* @flow */
'use strict';

import Task = require('./Task');
import Barrier = require('./Barrier');
import BuildSession = require('./BuildSession');

class Graph extends Task {
  constructor(name:string, graph:Graph, public inputs:Set<Task> = new Set<Task>()) {
    super(name, graph);
  }

  reset() {
    this.inputs.forEach((input) => {input.reset();});
    super.reset();
  }
  protected runAction(action: Task.Action, buildSession: BuildSession) {
    console.trace("Run task %s (action=%s)", this.name, Task.Action[action]);
    var barrier = new Barrier("Graph");
    var errors = 0;

    function cb(task: Task) {
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
    }

    function run(task: Task) {
      if (task.requirements !== 0) return;
      console.trace("Run task %s (action=%s)", task.name, Task.Action[action], task.requirements);

      barrier.inc();
      task.start(action, cb, buildSession);
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
  export interface SessionData extends Task.SessionData {
    tasks: string[];
  }
  export type Tasks = Iterable<Task>;
  export interface BuildTasksCallback {
    (err: Error, tasks?: Tasks);
  }
}
export = Graph;