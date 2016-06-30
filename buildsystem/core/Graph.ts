import {Task, TaskName} from './task';
import {File} from './file';
import {Runner, Step} from './runner';
import {Barrier} from './barrier';

export class Graph extends Task {
  constructor(name: TaskName, graph:Graph, public inputs:Set<Task> = new Set<Task>()) {
    super(name, graph);
  }

  do(gstep: Step) {
    var barrier = new Barrier("Graph");
    var self = this;
    var map = new Map<Task, {step: Step, requirements: number}>();
    this.inputs.forEach(function (task) {
      var substep = getstep(task);
      if (substep.requirements === 0)
        run(substep, task);
    });
    barrier.endWith(gstep.continue.bind(gstep));

    function getstep(task: Task) {
      var step = map.get(task);
      if (!step) {
        step = { requirements: task.dependencies.size, step: null };
        map.set(task, step);
      }
      return step;
    }
    
    function cb(step: Step) {
      var task = step.task;
      console.trace("End task %s %s (action=%s)", task.name.type, task.name.name, step.failed, task.requiredBy.size);
      if (!step.failed) {
        task.requiredBy.forEach(function (next) {
          var n = getstep(next);
          if (--n.requirements === 0)
            run(n, next);
        });
      }
      else {
        console.debug("Task %s %s failed", task.name.type, task.name.name);
        console.debug(step.logs);
        gstep.failed = true;
      }
      barrier.dec();
    }
    
    function run(substep, task: Task) {
      barrier.inc();
      if (!substep.step)
        substep.step = new Step(gstep.runner, task);
      substep.step.once(cb);
    }
  }

  iterate(deep: boolean = false, shouldIContinue?: (task: Task) => boolean) {
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
    })
  }

  allTasks(deep: boolean = false): Set<Task> {
    return this.iterate(deep);
  }

  findTask(deep: boolean, predicate: (task: Task) => boolean) : Task {
    var task = null;
    var ret = predicate(this);
    if (ret === true)
      return this;

    this.iterate(deep, (t) => {
      var ret= !predicate(t);
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
      while(level--) desc += "  ";
      desc += " " + prefix + " " + d + "\n";
    };
    var appendTasks = (level:number, graph: Graph) => {
      append(level, '+', graph.name.type + " " + graph.name.name);
      ++level;
      var tasks = graph.allTasks();
      tasks.forEach((task) => {
        if(task instanceof Graph)
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
