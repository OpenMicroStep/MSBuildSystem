import {Task, TaskName, File, Step, Barrier} from './index.priv';

export class Graph extends Task {
  constructor(name: TaskName, graph: Graph, public inputs: Set<Task> = new Set<Task>()) {
    super(name, graph);
  }

  do(flux: Step<any>) {
    var barrier = new Barrier("Graph");
    var map = new Map<Task, { running: boolean, requirements: number }>();
    this.inputs.forEach(function (task) {
      var substep = getstep(task);
      if (substep.requirements === 0)
        run(substep, task);
    });
    barrier.endWith(() => { flux.continue(); });

    function getstep(task: Task) {
      var step = map.get(task);
      if (!step) {
        step = { requirements: task.dependencies.size, running: false };
        map.set(task, step);
      }
      return step;
    }

    function lastAction(step: Step<any>) {
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

    function run(substep: { running: boolean, requirements: number }, task: Task) {
      if (!substep.running) {
        substep.running = true;
        barrier.inc();
        flux.context.execute(flux.context.runner, task, lastAction);
      }
    }
  }

  *iterator(deep = true) : IterableIterator<Task> {
    var tasks = new Set<Task>();
    function* iterate(inputs: Iterable<Task>) {
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

  iterate(deep: boolean, shouldIContinue?: (task: Task) => boolean) {
    var tasks = new Set<Task>();
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

  listOutputFiles(set: Set<File>) {
    this.iterate(false, (task) => {
      task.listOutputFiles(set);
      return true;
    });
  }

  allTasks(deep: boolean = false) : Set<Task> {
    return this.iterate(deep);
  }

  findTask(deep: boolean, predicate: (task: Task) => boolean) : Task | null {
    var task: Task | null = null;
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

  description() {
    console.time("description");
    var desc = "";
    var append = (level: number, prefix: string, d: string) => {
      while (level--) desc += "  ";
      desc += " " + prefix + " " + d + "\n";
    };
    var appendTasks = (level: number, graph: Graph) => {
      append(level, '+', graph.name.type + " " + graph.name.name);
      ++level;
      var tasks = graph.allTasks();
      tasks.forEach((task) => {
        if (task instanceof Graph)
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
