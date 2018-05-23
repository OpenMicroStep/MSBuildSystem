import {Node, File, Step, Barrier} from '../index.priv';

export class Graph extends Node {
  /** @internal */ inputs: Set<Node> = new Set<Node>();
  /** @internal */ outputs: Set<Node> = new Set<Node>();
  constructor(name: Node.Name, graph: Graph) {
    super(name, graph);
  }

  storagePath(task: Node) : string | undefined {
    return this.graph && this.graph.storagePath(task);
  }

  do(flux: Step<{}>) {
    var barrier = new Barrier("Graph");
    var map = new Map<Node, { running: boolean, requirements: number }>();
    this.inputs.forEach(function (task) {
      var substep = getstep(task);
      if (substep.requirements === 0)
        run(substep, task);
    });
    barrier.endWith(() => { flux.continue(); });

    function getstep(task: Node) {
      var step = map.get(task);
      if (!step) {
        step = { requirements: task.dependencies.size, running: false };
        map.set(task, step);
      }
      return step;
    }

    function lastAction(step: Step<{}>) {
      let ctx = step.context;
      let task = ctx.task;
      // console.trace("End task %s %s (action=%s)", task.name.type, task.name.name, step.failed, task.requiredBy.size);
      if (!ctx.reporter.failed) {
        task.requiredBy.forEach(function (next) {
          let n = getstep(next);
          if (--n.requirements === 0)
            run(n, next);
        });
      }
      else {
        flux.context.reporter.failed = true;
      }
      barrier.dec();
    }

    function run(substep: { running: boolean, requirements: number }, task: Node) {
      if (!substep.running) {
        substep.running = true;
        barrier.inc();
        flux.context.execute(flux.context.runner, task, lastAction);
      }
    }
  }

  *iterator(deep = true) : IterableIterator<Node> {
    var tasks = new Set<Node>();
    function* iterate(inputs: Iterable<Node>) {
      for (let input of inputs) {
        if (!tasks.has(input)) {
          tasks.add(input);
          yield input;
          if (deep && input instanceof Graph)
            yield *iterate(input.inputs);
        }
      }
      for (let input of inputs) {
        yield *iterate(input.requiredBy);
      }
    }
    if (deep)
      yield this;
    yield* iterate(this.inputs);
  }

  iterate(deep: boolean, shouldIContinue?: (task: Node) => boolean) {
    var tasks = new Set<Node>();
    var end = false;
    function iterate(inputs) {
      if (end) return;
      inputs.forEach(function(input) {
        if (!end && !tasks.has(input)) {
          tasks.add(input);
          if (shouldIContinue && shouldIContinue(input) === false)
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

  isOutputFileChecker() : (absolute_path: string) => boolean {
    let files = new Set<string>();
    let checkers: ((absolute_path: string) => boolean)[]  = [];
    for (let task of this.iterator(true)) {
      let checker = (task as Graph).buildOutputFileChecker(files);
      if (checker)
        checkers.push(checker);
    }
    let checker = checkers.length ? (absolute_path: string) => checkers.some(c => c(absolute_path)) : undefined;
    return this.finalizeOutputFileChecker(files, checker);
  }

  allTasks(deep: boolean = false) : Set<Node> {
    return this.iterate(deep);
  }

  findTask(deep: boolean, predicate: (task: Node) => boolean) : Node | null {
    var task: Node | null = null;
    var ret = predicate(this);
    if (ret === true)
      return this;

    this.iterate(deep, (t) => {
      var ret = !predicate(t);
      if (!ret)
        task = t;
      return ret;
    });
    return task;
  }
}
