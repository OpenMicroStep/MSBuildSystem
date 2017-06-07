import {EventEmitter} from 'events';
import {Node, Graph, BuildSession, Async, TaskReporter, Flux, Diagnostic} from './index.priv';
import * as os from 'os';

export type RunnerContext = { runner: Runner, failed: boolean };
export type ReduceStepContext = {
  runner: Runner,
  reporter: TaskReporter,
}
export type StepContext<DATA, SHARED> = {
  runner: Runner,
  execute(runner: Runner, task: Node, lastAction: (flux: Flux<StepContext<any, any>>) => void),
  task: Node,
  reporter: TaskReporter,
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

export var maxConcurrentTasks: number = os.cpus().length;
var nbTaskRunning: number = 0;
var waitingTasks: (() => void)[] = [];
function takeTaskSlot(step: Flux<{}>) {
  if (nbTaskRunning < maxConcurrentTasks || maxConcurrentTasks === 0) {
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

function giveTaskSlot(step: Flux<{}>) {
  nbTaskRunning--;
  if (waitingTasks.length > 0)
    waitingTasks.shift()!();
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
  ctx.data.lastSuccessTime = ctx.lastSuccessTime = ctx.reporter.failed ? 0 : ctx.lastRunStartTime;
  ctx.storage.set(ctx.runner.action, ctx.data);
  ctx.storage.set("SHARED", ctx.sharedData);
  ctx.storage.save(() => {
    ctx.runner.emit("taskend", ctx);
    flux.continue();
  });
}

function execute(runner: Runner, task: Node, lastAction: (flux: Flux<StepContext<any, any>>) => void) {
  Async.run<StepContext<any, any>>({
    runner: runner,
    execute: execute,
    task: task,
    storage: task.getStorage(),
    reporter: new TaskReporter(),
    data: null,
    sharedData: null,
    lastRunStartTime: 0,
    lastRunEndTime: 0,
    lastSuccessTime: 0
  }, task instanceof Graph
    ? [start, task.do.bind(task), end, lastAction]
    : [takeTaskSlot, start, task.do.bind(task), end, giveTaskSlot, lastAction]);
}

function executeMapReduceRun<V>(p: Flux<RunnerContext>, run: (step: Flux<ReduceStepContext>, value: V) => void, value: V) {
  Async.run<ReduceStepContext>({
    runner: p.context.runner,
    reporter: new TaskReporter()
  }, [takeTaskSlot, f => run(f, value), giveTaskSlot, (flux) => {
    p.context.failed = p.context.failed || flux.context.reporter.failed;
    flux.continue();
    p.continue();
  }]);
}

function isChildOf(parent: Node, task: Node) {
  return task.parents().indexOf(<Graph>parent) !== -1;
}

function createTaskAction(task: Node) {
  return function run(p: Flux<RunnerContext>) {
    execute(p.context.runner, task, (flux) => {
      p.context.failed = p.context.failed || flux.context.reporter.failed;
      flux.continue();
      p.continue();
    });
  };
}

export class Runner extends EventEmitter {
  root: Node;
  action: string;
  options: { [s: string]: any };
  enabled: Set<Node>;

  constructor(root: Node, action: string, options: { [s: string]: any } = {}) {
    super();
    this.root = root;
    this.action = action;
    this.options = options;
    this.enabled = new Set<Node>();
  }

  enable(task: Node) {
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

  *[Symbol.iterator]() {
    yield* this.iterator(true);
  }

  *iterator(deep = true) : IterableIterator<Node> {
    function *iterate(task: Node) : IterableIterator<Node> {
      if (task instanceof Graph)
        yield* task.iterator(true);
      else
        yield task;
    }
    if (this.enabled.size === 0)
      yield* iterate(this.root);
    else
      for (let task of this.enabled)
        yield* iterate(task);
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

  runWithMapReduce<V, K>(p: Flux<RunnerContext & { values?: V[] }>, provider: TaskDoMapReduce<V, K>) {
    let map = provider.map;
    let reduce = provider.reduce;
    let run = provider.run;
    let returnValues = provider.returnValues;
    let naiveMapStorage = new Map<K, V[]>();
    let mapCallback = (ctx) => {
      let value = ctx.value;
      if (value !== undefined) {
        let k = map(value);
        let values = naiveMapStorage.get(k);
        if (!values)
          naiveMapStorage.set(k, values = []);
        values.push(value);
      }
    };
    p.setFirstElements((f) => {
      this.removeListener('taskend', mapCallback);
      let reducedValues = <V[]>[];
      let reporter = new TaskReporter();
      naiveMapStorage.forEach( values => reducedValues.push(reduce(reporter, values)) );
      if (run && reducedValues.length)
        f.setFirstElements([reducedValues.map(v => f => executeMapReduceRun(f, run!, v))]);
      if (returnValues)
        f.context.values = reducedValues;
      f.continue();
    });
    this.on('taskend', mapCallback);
    this.run(p);
  }
}

export interface Runner {
  emit(event: "taskbegin", context: StepContext<any, any>);
  emit(event: "taskend", context: StepContext<any, any>);
  on(event: "taskbegin", listener: (ctx: StepContext<any, any>) => void) : this;
  on(event: "taskend", listener: (ctx: StepContext<any, any>) => void) : this;
}

export type TaskDoMapReduce<V, K> = {
  map: (context: V) => K;
  reduce: (reporter: TaskReporter, contexts: V[]) => V;
  run?: (step: Flux<ReduceStepContext>, value: V) => void;
  returnValues: boolean
};
