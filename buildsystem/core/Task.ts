import Graph = require('./Graph');
import events = require('events');
import Barrier = require('./Barrier');
import BuildSession = require('./BuildSession');
import util = require('util');
import crypto = require('crypto');
import os = require('os');

var __id_counter: number = 0;

var classes = {};

class Task extends events.EventEmitter {
  static maxConcurrentTasks: number = os.cpus().length;
  static nbTaskRunning: number = 0;
  private static waitingTasks: Task[] = [];

  dependencies : Set<Task> = new Set<Task>();
  requiredBy : Set<Task> = new Set<Task>();
  name: Task.Name;
  graph: Graph;
  classname: string; // on the prototype, see registerClass
  constructor(name: Task.Name, graph: Graph) {
    super();
    this.name = name;
    this.graph = graph;
    if(this.graph) {
      this.graph.inputs.add(this);
    }
    if (!this.classname)
      Task.registerClass(this.constructor, this.constructor.name);
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
  enabled: number = 0;
  action: Task.Action = null;
  private observers: Array<(task: Task) => any> = [];
  requirements: number = 0;
  logs: string = "";
  errors: number = 0;

  private sessionKey: string= undefined;
  storage: BuildSession = null;
  data = null;
  sharedData: any = null;

  /** Get the task ready for the next run */
  reset() {
    this.enabled = 0;
    this.action = null;
    this.state = Task.State.WAITING;
    this.observers = [];
    this.logs = "";
    this.errors = 0;
    this.requirements = this.dependencies.size;
    this.requiredBy.forEach(function(input) {input.reset();});
  }

  enable() {
    var parent = this.graph;
    while (parent) {
      if (parent.enabled !== 1)
        parent.enabled = 2;
      parent = parent.graph;
    }
    this.enabled = 1;
  }

  uniqueKey(): string { return "__" + (++__id_counter).toString(); }

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

  preprocess() {

  }

  postprocess() {

  }

  start(action: Task.Action, callback: (task: Task) => any) {
    if(this.state === Task.State.WAITING) {
      this.action = action;
      this.state = Task.State.RUNNING
      this.observers.push(callback);
      this.storage = this.getStorage();
      this.storage.load(() => {
        this.data = this.storage.get(Task.Action[action]) || {};
        this.sharedData = this.storage.get("SHARED") || {};
        this.data.lastRunStartTime = Date.now();
        this.data.lastRunEndTime = this.data.lastRunEndTime || 0;
        this.data.lastSuccessTime = this.data.lastSuccessTime || 0;
        this.preprocess();
        this.emit("start", action);
        this.runAction(action);
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

  root() : Graph {
    var graph = this.graph;
    while(graph && graph.graph)
      graph = graph.graph;
    return graph;
  }

  getStorage() : BuildSession {
    var p = this.storagePath(this);
    return p ? new BuildSession.FastJSONDatabase(p) : BuildSession.noop;;
  }

  storagePath(task: Task) {
    return this.graph.storagePath(task);
  }

  end(errors: number = 0) {
    if (this.state !== Task.State.RUNNING) {
      console.error("end called multiple times", this.name);
      return;
    }
    console.debug(this.name.type, this.name.name, "\n", this.logs);
    this.errors = errors;
    this.state = Task.State.DONE;
    this.data.logs = this.logs;
    this.data.errors = errors;
    this.data.lastRunEndTime = Date.now();
    this.data.lastSuccessTime = errors ? 0 : this.data.lastRunEndTime;
    this.postprocess();
    this.storage.set(Task.Action[this.action], this.data);
    this.storage.set("SHARED", this.sharedData);
    this.storage.save(() => {
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
      var root = this.root();
      if (root && root)
        root.emit("childtaskend", this);
      this.emit("end", this.action);
      this.storage = null;
      this.data = null;
      this.sharedData = null;
    });
  }

  protected runAction(action: Task.Action) {
    switch (action) {
      case Task.Action.RUN:
        this.isRunRequired((err, required) => {
          if (err) {
            this.log(err.toString());
            this.end(1);
          }
          else if (required) {
            if (Task.nbTaskRunning < Task.maxConcurrentTasks) {
              ++Task.nbTaskRunning;
              this.run();
            } else {
              Task.waitingTasks.push(this);
            }
          }
          else {
            this.logs = this.data.logs || "";
            this.end();
          }
        });
        break;
      case Task.Action.CLEAN:
        this.clean();
        break;
      default:
        this.end(0);
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
  export type Name = { type: string, name: string, [s: string]: string };
  export enum State {
    UNINITIALIZED,
    WAITING,
    RUNNING,
    DONE
  }

  export enum Action {
    CONFIGURE, // Load data, prepare tasks
    RUN      , // Run tasks
    CLEAN    , // Clean tasks
  }
}
export = Task;