import {Graph, Target, Step, File, BuildSession} from './index.priv';
import {createHash, Hash} from 'crypto';

export type TaskName = { type: string, name: string, [s: string]: string };

export var taskClasses = new Map<string, typeof Task>();
export function declareTask(options: { type: string }) {
  return function (constructor: { new (...args) : Task, prototype: typeof Task.prototype }) {
    constructor.prototype.classname = options.type;
    taskClasses.set(options.type, constructor);
  };
}

export function getTask(type: string) : typeof Task | undefined {
  return taskClasses.get(type);
}

export class Task {
  dependencies: Set<Task> = new Set<Task>();
  requiredBy: Set<Task> = new Set<Task>();
  name: TaskName;
  graph: Graph | null;
  private sessionKey: string | undefined | null;

  classname: string; // on the prototype, see registerClass
  constructor(name: TaskName, graph: Graph | null) {
    this.name = name;
    this.graph = graph;
    this.sessionKey = undefined;
    if (graph)
      graph.inputs.add(this);
  }

  /** fill the hash with data that can identify the task and its settings accross sessions
   * returns false if the task can't reuse previous run informations  */
  uniqueKey(hash: Hash) : boolean {
    return false;
  }

  /** returns the unique identifier of the task, this identifier is valid accross sessions */
  id() : string | null {
    if (this.sessionKey === undefined) {
      this.sessionKey = null;
      var shasum = createHash('sha1');
      if (this.uniqueKey(shasum))
        this.sessionKey = this.classname + "-" + shasum.digest('hex');
    }
    return this.sessionKey;
  }

  /** returns the unique and reusable accross session data storage of this task */
  getStorage() : BuildSession.BuildSession {
    var p = this.storagePath(this);
    return p ? new BuildSession.FastJSONDatabase(p) : BuildSession.noop;
  }

  /** returns the target that contains this task */
  target() : Target {
    var task: Task | null = this;
    while (task && !(task instanceof Target))
      task = task.graph;
    if (!task)
      throw new Error("logic error: this task has no target associated");
    return task;
  }

  /** returns the absolute data storage path of the given task */
  storagePath(task: Task) {
    return this.graph && this.graph.storagePath(task);
  }

  addDependencies(tasks: Task[]) {
    tasks.forEach((task) => { this.addDependency(task); });
  }
  addDependency(task: Task) {
    if (task === this)
      throw "Can't add it as task dependency";
    if (!this.graph)
      throw "Can't add task dependency, there is no graph";
    if (this.graph !== task.graph)
      throw "Can't add task dependency that is contained in another graph";
    this.graph.inputs.delete(this);
    this.dependencies.add(task);
    task.requiredBy.add(this);
  }

  iterateDependencies(deep: boolean = false, shouldIContinue?: (task: Task, lvl: number) => boolean) {
    var end = false;
    var iterated = new Set<Task>();
    var iterate = (t: Task, lvl: number) => {
      t.dependencies.forEach((dep) => {
        if (!end && !iterated.has(dep)) {
          iterated.add(dep);
          if (shouldIContinue && shouldIContinue(dep, lvl) === false)
            end = true;
          else if (deep)
            iterate(dep, lvl + 1);
        }
      });
    };
    iterate(this, 0);
    return iterated;
  }

  root() : Graph | null {
    var graph = this.graph;
    while (graph && graph.graph)
      graph = graph.graph;
    return graph;
  }

  listDependenciesOutputFiles(set: Set<File>) {
    this.dependencies.forEach((t) => {
      t.listOutputFiles(set);
      t.listDependenciesOutputFiles(set);
    });
  }

  listOutputFiles(set: Set<File>) { }

  do(step: Step) {
    switch (step.runner.action) {
      case "build":
        step.setFirstElements([
           (step) => { this.isRunRequired(step); },
           (step) => {
             if (step.failed)
               step.continue();
             else if (step.context.runRequired)
              this.run(step);
             else {
               step.reuseLastRunData();
               step.continue(); }
           }
        ]);
        step.continue();
        break;

      case "clean":
        this.clean(step);
        break;

      default:
        step.diagnostic({
          type: "warning",
          msg: `task doesn't support "${step.runner.action}" action`
        });
        step.continue();
        break;
    }
  }

  isRunRequired(step: Step) {
    step.context.runRequired = true;
    step.continue();
  }

  run(step: Step) {
    step.diagnostic({
      type: "fatal error",
      msg: "'run' must be reimplemented by subclasses"
    });
    step.continue();
  }

  clean(step: Step) {
    step.continue();
  }

  toString() {
    return this.name.type + ":" + this.name.name;
  }
  description() {
    return this.toString();
  }
}

