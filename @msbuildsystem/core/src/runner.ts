import {EventEmitter} from 'events';
import {Task, Graph, TGraph, BuildSession, Async, Reporter, Flux, Diagnostic} from './index.priv';
import * as os from 'os';

export type RunnerContext = { runner: Runner, failed: boolean };
export type StepContext<DATA, SHARED> = {
  runner: Runner,
  execute(runner: Runner, task: Task, lastAction: (flux: Flux<StepContext<any, any>>) => void),
  task: Task,
  reporter: Reporter,
  storage: BuildSession.BuildSession,
  data: {
    lastRunStartTime?: number,
    lastRunEndTime?: number,
    lastSuccessTime?: number,
    logs?: string,
    diagnostics?: Diagnostic[]
  } & DATA;
  sharedData: SHARED;
  lastRunStartTime: number;
  lastRunEndTime: number;
  lastSuccessTime: number;
}
export type StepData<DATA> = DATA & {
  lastRunStartTime: number;
  lastRunEndTime: number;
  lastSuccessTime: number;
};

export type Step<T> = Flux<StepContext<{}, {}> & T>;
export type StepWithData<T, DATA, SHARED> = Flux<StepContext<DATA, SHARED> & T>;

export var maxConcurrentTasks: number = 1; //os.cpus().length;
var nbTaskRunning: number = 0;
var waitingTasks: (() => void)[] = [];
function takeTaskSlot(step: Step<{}>) {
  if (step.context.task instanceof TGraph) {
    step.continue();
  }
  else if (nbTaskRunning < maxConcurrentTasks || maxConcurrentTasks === 0) {
    nbTaskRunning++;
    step.continue();
  }
  else {
    waitingTasks.push(() => {
      nbTaskRunning++;
      step.continue();
    });
  }
}

function giveTaskSlot(step: Step<{}>) {
  if (!(step.context.task instanceof TGraph)) {
    nbTaskRunning--;
    if (waitingTasks.length > 0)
      waitingTasks.shift()!();
  }
  step.continue();
}

function start(flux: Flux<StepContext<{}, {}>>) {
  let ctx = flux.context;
  ctx.storage.load(() => {
    ctx.data = ctx.storage.get(ctx.runner.action) || {};
    ctx.sharedData = ctx.storage.get("SHARED") || {};
    ctx.lastRunStartTime = Date.now();
    ctx.lastRunEndTime = ctx.data.lastRunEndTime || 0;
    ctx.lastSuccessTime = ctx.data.lastSuccessTime || 0;
    ctx.runner.emit("taskbegin", ctx);
    flux.continue();
  });
}

function end(flux: Flux<StepContext<{}, {}>>) {
  let ctx = flux.context;
  ctx.data.logs = ctx.reporter.logs;
  ctx.data.diagnostics = ctx.reporter.diagnostics;
  ctx.data.lastRunEndTime = ctx.lastRunEndTime = Date.now();
  ctx.data.lastRunStartTime = ctx.lastRunStartTime;
  ctx.data.lastSuccessTime = ctx.lastSuccessTime = ctx.reporter.failed ? 0 : ctx.data.lastRunEndTime;
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
  }, [takeTaskSlot, start, task.do.bind(task), end, giveTaskSlot, lastAction]);
}

function isChildOf(parent: Task, task: Task) {
  return task.parents().indexOf(<Graph>parent) !== -1;
}

function createTaskAction(task: Task) {
  return function run(p: Flux<RunnerContext>) {
    execute(p.context.runner, task, (flux) => {
      p.context.failed = p.context.failed || flux.context.reporter.failed;
      flux.continue();
      p.continue();
    });
  };
}

export class Runner extends EventEmitter {
  root: Task;
  action: string;
  options: { [s: string]: any };
  enabled: Set<Task>;

  constructor(root: Task, action: string, options: { [s: string]: any } = {}) {
    super();
    this.root = root;
    this.action = action;
    this.options = options;
    this.enabled = new Set<Task>();
  }

  enable(task: Task) {
    let parents = task.parents();
    let alreadyEnabled = this.enabled.has(task) || parents.some(p => this.enabled.has(p));
    if (!alreadyEnabled) {
      this.enabled.forEach(t => {
        if (isChildOf(task, t))
          this.enabled.delete(t);
      });
      this.enabled.add(task);
    }
  }

  run(p: Flux<RunnerContext>) {
    p.context.runner = this;
    if (this.enabled.size === 0) {
      createTaskAction(this.root)(p);
    }
    else {
      p.setFirstElements([Array.from(this.enabled).map(createTaskAction)]);
      p.continue();
    }
  }
}

export interface Runner {
  emit(event: "taskbegin", context: StepContext<any, any>);
  emit(event: "taskend", context: StepContext<any, any>);
  on(event: "taskbegin", listener: (ctx: StepContext<any, any>) => void) : this;
  on(event: "taskend", listener: (ctx: StepContext<any, any>) => void) : this;
}
