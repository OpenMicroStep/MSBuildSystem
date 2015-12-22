/// <reference path="../../typings/tsd.d.ts" />
/* @flow weak */
'use strict';
import Graph = require('./Graph');
import events = require('events');
import Barrier = require('./Barrier');
import BuildSession = require('./BuildSession');
import util = require('util');
import crypto = require('crypto');
import os = require('os');

var __id_counter: number = 0;

var classes = {};

class Task {
  static maxConcurrentTasks: number = os.cpus().length;
  static nbTaskRunning: number = 0;
  private static waitingTasks: Task[] = [];

  protected _id:number;
  dependencies : Set<Task> = new Set<Task>();
  requiredBy : Set<Task> = new Set<Task>();
  name: string;
  graph: Graph;
  classname: string; // on the prototype, see registerClass
  constructor(name: string, graph: Graph) {
    this._id = ++__id_counter;
    this.name = name;
    this.graph = graph;
    if(this.graph) {
      this.graph.inputs.add(this);
    }
  }
  static registerClass(cls, taskTypeName: string) {
    if(taskTypeName) {
      console.debug("Task '%s' registed (raw name='%s')", taskTypeName, cls.name);
      classes[taskTypeName] = cls;
      cls.prototype.classname = taskTypeName;
    }
  }
  static findTask(taskTypeName: string) {
    return classes[taskTypeName];
  }
  isInstanceOf(classname: string) {
    return (classname in classes && this instanceof classes[classname]);
  }

  addDependencies(tasks : Array<Task>) {
    tasks.forEach((task) => { this.addDependency(task)});
  }
  addDependency(task: Task) {
    if(task === this)
      throw "Can't add it as task dependency";
    if(this.graph !== task.graph)
      throw "Can't add task dependency that is contained in another graph";
    if(this.graph.inputs.has(this)) {
      this.graph.inputs.delete(this);
    }
    this.dependencies.add(task);
    task.requiredBy.add(this);
  }

  state: Task.State = Task.State.UNINITIALIZED;
  private observers: Array<(task: Task) => any>;
  requirements: number;
  logs: string;
  errors: number;

  private sessionKey: string= undefined;
  data: Task.SessionData;

  /** Get the task ready for the next run */
  reset() {
    this.state = Task.State.WAITING;
    this.observers = [];
    this.logs = "";
    this.errors = 0;
    this.requirements = this.dependencies.size;
    this.requiredBy.forEach(function(input) {input.reset();});
  }

  uniqueKey(): string { return null; }

  id() {
    if(this.sessionKey === undefined) {
      this.sessionKey = null;
      var key = this.uniqueKey();
      if (key) {
        var shasum = crypto.createHash('sha1');
        shasum.update(key);
        this.sessionKey = this.classname + "-" + shasum.digest('hex');
      }
    }
    return this.sessionKey;
  }

  addObserver(callback: (task: Task) => any) {
    this.observers.push(callback);
  }

  start(action: Task.Action, callback: (task: Task) => any, buildSession: BuildSession = BuildSession.noop) {
    if(this.state === Task.State.WAITING) {
      var id = this.id() + "-" + Task.Action[action];
      this.observers.push(() => {
        buildSession.storeInfo(id, this.data);
      });
      this.observers.push(callback);
      buildSession.retrieveInfo(id, (data) => {
        this.data = data || {};
        this.data.lastRunStartTime = (new Date()).getTime();
        this.data.lastRunEndTime = this.data.lastRunEndTime || 0;
        this.data.lastSuccessTime = this.data.lastSuccessTime || 0;
        this.runAction(action, buildSession);
      });
    }
    else if(this.state === Task.State.DONE) {
      callback(this);
    }
    else if(this.state === Task.State.RUNNING) {
      this.observers.push(callback);
    }
    else {
      this.reset();
      this.log("Task was not initialized");
      this.end(1);
    }
  }

  log(msg: string) {
    this.logs += msg;
    if(msg.length && msg[msg.length - 1] != "\n")
      this.logs += "\n";
  }
  end(errors: number = 0) {
    console.debug(this.name, "\n", this.logs);
    this.errors = errors;
    this.state = Task.State.DONE;
    this.data.logs = ""; //this.logs;
    this.data.errors = errors;
    this.data.lastRunEndTime = (new Date()).getTime();
    this.data.lastSuccessTime = errors ? 0 : this.data.lastRunEndTime;
    --Task.nbTaskRunning;
    //process.stderr.write(this.logs);
    if (Task.waitingTasks.length > 0) {
      var task = Task.waitingTasks.shift();
      ++Task.nbTaskRunning;
      task.run();
    }
    this.observers.forEach((obs) => {
      obs(this);
    });
  }

  protected runAction(action: Task.Action, buildSession: BuildSession) {
    switch (action) {
      case Task.Action.RUN:
      case Task.Action.REBUILD:
        this.isRunRequired((err, required) => {
          if (err) {
            this.log(err.toString());
            this.end(1);
          }
          else if (required || action === Task.Action.REBUILD) {
            if (Task.nbTaskRunning < Task.maxConcurrentTasks) {
              ++Task.nbTaskRunning;
              this.run();
            } else {
              Task.waitingTasks.push(this);
            }
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

  isRunRequired(callback: (err: Error, required?:boolean) => any) {
    callback(null, true);
  }
  run() {
    this.log("'run' must be reimplemented by subclasses");
    this.end(1);
  }
  clean() {
    this.end();
  }

  toString() {
    return this.name;
  }
  description() {
    return this.name + ", state=" + Task.State[this.state];
  }
}

module Task {
  export interface SessionData {
    logs: string;
    errors: number;
    lastRunStartTime:number;
    lastRunEndTime:number;
    lastSuccessTime: number;
  }
  export enum State {
    UNINITIALIZED,
    WAITING,
    RUNNING,
    DONE
  }

  export enum Action {
    CONFIGURE,
    RUN,
    CLEAN,
    REBUILD
  }
}
export = Task;