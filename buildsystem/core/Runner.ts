import {EventEmitter} from 'events';
import {format} from 'util';
import {Async, Flux} from '../../shared/async';
import {Diagnostic, diagnosticFromError} from '../../shared/diagnostic';
import {Task} from './task';
import {applyMixins} from './util';

export class Runner extends EventEmitter {
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

  run(p: Async) {
    var step = new Step(this, this.root);
    p.context.runner = this;
    p.context.step = step;
    step.once(() => {
      p.continue();
    });
  }
}

export function skipStepIfFailed(element: (step: Step) => void) {
  return function(step: Step) {
    if (step.failed)
      step.continue();
    else
      element(step);
  }
}

export class Reporter {
  logs: string = "";
  diagnostics: Diagnostic[] = [];
  failed: boolean = false;
  
  log(...args) {
    this.logs += format.apply(null, arguments);
  }
  lognl(...args) {
    this.log(...args);
    this.logs += "\n";
  }
  debug(...args) {
    this.log(...args);
  }
  debugnl(...args) {
    this.log(...args);
    this.logs += "\n";
  }
  
  diagnostic(d: Diagnostic) {
    this.diagnostics.push(d);
    if (d.type === "error" || d.type === "fatal error")
      this.failed = true;
  }
  
  error(err: Error, base?: Diagnostic) {
    this.diagnostic(diagnosticFromError(err, base));
  }
  
  description() {
    var desc = `${this.diagnostic.length} diagnostics: \n`;
    this.diagnostics.forEach(d => {
      desc += ` - [${d.type}] ${d.msg}\n`;
    });
    return desc;
  }
}

export class Step extends Flux implements Reporter {
  runner: Runner;
  task: Task;
  logs: string;
  diagnostics: Diagnostic[];
  failed: boolean;
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
    this.failed = false;
    this.diagnostics = [];
    this.storage = null;
    this.data = null;
    this.sharedData = null;
    this.lastRunStartTime = null;
    this.lastRunEndTime = null;
    this.lastSuccessTime = null;
    this._once = null;
  }
  
  setFirstElements(elements: ((step: Step) => void) | ((step: Step) => void)[]) : void {
    super.setFirstElements(elements);
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
  
  reuseLastRunData() {
    this.logs = this.data.logs || "";
    this.diagnostics = this.data.diagnostics || [];
  }

  log: (...args) => void;
  lognl: (...args) => void;
  debug: (...args) => void;
  debugnl: (...args) => void;
  diagnostic: (d: Diagnostic) => void;
  error: (err: Error, base?: Diagnostic) => void;
  description: () => string;

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
    this.data.diagnostics = this.diagnostics;
    this.data.lastRunEndTime = Date.now();
    this.data.lastRunStartTime = this.lastRunStartTime;
    this.data.lastSuccessTime = this.diagnostics.length > 0 ? 0 : this.data.lastRunEndTime;
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

applyMixins(Step, [Reporter]);