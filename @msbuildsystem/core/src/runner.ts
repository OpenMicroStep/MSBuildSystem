import {EventEmitter} from 'events';
import {format} from 'util';
import {Task, BuildSession, Async} from './index.priv';
import {Flux, Diagnostic, diagnosticFromError} from '@msbuildsystem/shared';

export type RunnerContext = { runner: Runner };
export type StepContext<DATA, SHARED> = {
  runner: Runner,
  execute(runner: Runner, task: Task, lastAction: (flux: Flux<StepContext<any, any>>) => void),
  task: Task,
  reporter: Reporter,
  storage: BuildSession.BuildSession,
  data: { logs?: string, diagnostics?: Diagnostic[] } & DATA;
  sharedData: SHARED;
  lastRunStartTime: number;
  lastRunEndTime: number;
  lastSuccessTime: number;
}
export type Step<T> = Flux<StepContext<{}, {}> & T>;
export type StepWithData<T, DATA, SHARED> = Flux<StepContext<DATA, SHARED> & T>;

function start(flux: Flux<StepContext<any, any>>) {
  let ctx = flux.context;
  ctx.storage.load(() => {
    ctx.data = ctx.storage.get(ctx.runner.action) || {};
    ctx.sharedData = ctx.storage.get("SHARED") || {};
    ctx.lastRunStartTime = Date.now();
    ctx.lastRunEndTime = ctx.data.lastRunEndTime || 0;
    ctx.lastSuccessTime = ctx.data.lastSuccessTime || 0;
    flux.continue();
  });
}

function end(flux: Flux<StepContext<any, any>>) {
  let ctx = flux.context;
  ctx.data.logs = ctx.reporter.logs;
  ctx.data.diagnostics = ctx.reporter.diagnostics;
  ctx.data.lastRunEndTime = Date.now();
  ctx.data.lastRunStartTime = ctx.lastRunStartTime;
  ctx.data.lastSuccessTime = ctx.reporter.failed ? ctx.data.lastRunEndTime : 0;
  ctx.storage.set(ctx.runner.action, ctx.data);
  ctx.storage.set("SHARED", ctx.sharedData);
  ctx.storage.save(() => {
    ctx.runner.emit("taskend", ctx);
    flux.continue();
  });
}

function execute(runner: Runner, task: Task, lastAction: (flux: Flux<StepContext<any, any>>) => void) {
  Async.run<StepContext<any, any>>({
    runner: runner,
    execute: execute,
    task: task,
    storage: task.getStorage(),
    reporter: new Reporter(),
    data: null,
    sharedData: null,
    lastRunStartTime: 0,
    lastRunEndTime: 0,
    lastSuccessTime: 0
  }, [start, task.do.bind(task), end, lastAction]);
}

export class Runner extends EventEmitter {
  context: any;
  root: Task;
  action: string;
  enabled: Set<Task>;
  failed: boolean;

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

  run(p: Flux<RunnerContext>) {
    p.context.runner = this;
    execute(this, this.root, (flux) => {
      this.failed = this.failed || flux.context.reporter.failed;
      flux.continue();
      p.continue();
    });
  }

  emit<T>(event: "taskend", context: StepContext<any, any>);
  emit(event: string, ...args) {
    super.emit(event, ...args);
  }

  on<T>(event: "taskend", listener: (ctx: StepContext<any, any>) => void) : this;
  on(event: string, listener: Function) : this {
    return super.on(event, listener);
  }
}

export class Reporter {
  /** raw logs */
  logs: string = "";
  /** structured diagnostics, use diagnostic(...) or error(...) to add somes */
  diagnostics: Diagnostic[] = [];
  /** true if the task failed, automatically set to true if a diagnostic of type error is added e*/
  failed: boolean = false;
  /** if not null, run a transformation on new diagnostics (ie. set category, prefix path, ...) */
  transform: ((diagnostic: Diagnostic) => Diagnostic)[] = [];


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
    if (!d) return;
    if (this.transform.length)
      d = this.transform[this.transform.length - 1](d);
    this.diagnostics.push(d);
    if (d.type === "error" || d.type === "fatal error")
      this.failed = true;
  }

  error(err: Error, base?: Diagnostic) {
    if (!err) return;
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
