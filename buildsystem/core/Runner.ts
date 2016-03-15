import Task = require('./Task');
import BuildSession = require('./BuildSession');
import File = require('./File');
import async = require('./async');
import events = require('events');
import os = require('os');

class Runner extends events.EventEmitter {
  context: any;
  root: Task;
  action: string;
  enabled: Set<Task>;

  constructor(root: Task, action: string) {
    super();
    this.root = root;
    this.context = {};
    this.action = action;
    this.enabled = new Set<Task>();
  }

  enable(task: Task) {
    var parent = task.graph;
    while (parent) {
      this.enabled.add(parent);
      parent = parent.graph;
    }
    this.enabled.add(task);
  }

  run(p: async.Async) {
    var step = new Runner.Step(this, this.root);
    p.context.runner = this;
    p.context.step = step;
    step.once(() => {
      p.continue();
    });
  }
}

module Runner {
  export class Step extends async.Flux {
    runner: Runner;
    task: Task;
    logs: string;
    errors: number;
    data: any;
    sharedData: any;
    lastRunStartTime: number;
    lastRunEndTime: number;
    lastSuccessTime: number;
    storage;
    _once: ((p) => void)[];

    constructor(runner: Runner, task: Task) {
      super([], {}, null);
      this.setFirstElements([this._start.bind(this), this._end.bind(this)]);
      this.task = task;
      this.runner = runner;
      this.logs = "";
      this.errors = 0;
      this.storage = null;
      this.data = null;
      this.sharedData = null;
      this.lastRunStartTime = null;
      this.lastRunEndTime = null;
      this.lastSuccessTime = null;
      this._once = null;
    }

    once(cb: (step: Step) => void) {
      if (this._once) {
        this._once.push(cb);
      }
      else if (this.storage === null) {
        this._once = [cb];
        this.continue();
      }
      else if (this._once === null) {
        cb(this);
      }
    }

    log(msg: any, appendNewLine = true) {
      if (msg === void 0) return;
      if (msg instanceof Error)
        msg = msg.stack || msg.message;
      if (!msg.length)
        return;
      this.logs += msg;
      if (appendNewLine)
        this.logs += "\n";
    }

    error(msg) {
      if (!msg) return;
      this.errors += 1;
      this.log("error: " + msg);
      if (msg instanceof Error)
        msg = msg.stack || msg.message;
      console.error(this.task.toString(), msg);
    }

    _start(p) {
      this.storage = this.task.getStorage();
      this.storage.load(() => {
        this.data = this.storage.get(this.runner.action) || {};
        this.sharedData = this.storage.get("SHARED") || {};
        this.lastRunStartTime = Date.now();
        this.lastRunEndTime = this.data.lastRunEndTime || 0;
        this.lastSuccessTime = this.data.lastSuccessTime || 0;
        this.task.do(this);
      });
    }

    _end() {
      this.data.logs = this.logs;
      this.data.errors = this.errors;
      this.data.lastRunEndTime = Date.now();
      this.data.lastRunStartTime = this.lastRunStartTime;
      this.data.lastSuccessTime = this.errors > 0 ? 0 : this.data.lastRunEndTime;
      this.storage.set(this.runner.action, this.data);
      this.storage.set("SHARED", this.sharedData);
      this.storage.save(() => {
        this.runner.emit("taskend", this);
        this.continue();
        this._once.forEach((cb) => { cb(this); });
        this._once = null;
      });
    }
  }
}

export = Runner;