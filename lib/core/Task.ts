/// <reference path="../../typings/tsd.d.ts" />
/* @flow weak */
import Graph = require('./Graph');
import events = require('events');
import Barrier = require('./Barrier');
var util = require('util');

var __id_counter: number = 0;

class Task {
  protected _id:number = ++__id_counter;
  actions: Set<string>;
  dependencies : Set<Task> = new Set<Task>();
  requiredBy : Set<Task> = new Set<Task>();
  constructor(public name: string) {}
  addDependencies(tasks : Array<Task>) {
    tasks.forEach((task) => { this.addDependency(task)});
  }
  addDependency(task: Task) {
    this.dependencies.add(task);
    task.requiredBy.add(this);
  }
  isRunRequired(callback: (err: Error, required?:boolean) => any) {
    callback(null, true);
  }

  start(action: Task.Action) {
    switch(action) {
      case Task.Action.RUN:
      case Task.Action.REBUILD:
        this.isRunRequired((err, required) => {
          if(err) {
            this.log(err.toString());
            this.end(1);
          }
          else if(required || action == Task.Action.REBUILD) {
            this.run();
          }
          else {
            this.end();
          }
        });
        break;
        break;
      case Task.Action.CLEAN:
        this.clean();
        break;
      default:
        this.log("Action not supported, action=" + action);
        this.end(1);
        break;
    }
  }

  run() {
    this.log("'run' must be reimplemented by subclasses");
    this.end(1);
  }
  clean() {
    this.end();
  }

  state: Task.State = Task.State.WAITING;
  observers: Array<(task: Task) => any> = [];
  requirements = 0;
  logs = "";
  errors: number = 0;
  log(msg: string) {
    //console.log(this.name, msg);
    this.logs += msg;
    if(msg.length && msg[msg.length - 1] != "\n")
      this.logs += "\n";
  }
  end(errors: number = 0) {
    this.errors = errors;
    this.state = Task.State.DONE;
    this.observers.forEach((obs) => {
      obs(this);
    });
  }

  reset() {
    this.state = Task.State.WAITING;
    this.observers = [];
    this.logs = "";
    this.errors = 0;
    this.requirements = this.dependencies.size;
    this.requiredBy.forEach(function(input) {input.reset();});
  }

  toString() {
    return this.name;
  }
  description() {
    return this.name + ", state=" + Task.State[this.state];
  }
}

module Task {
  export enum State {
    WAITING,
    RUNNING,
    DONE
  }

  export enum Action {
    RUN,
    CLEAN,
    REBUILD
  }
}
export = Task;