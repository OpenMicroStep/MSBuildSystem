import {Graph} from './graph';
import {Target} from './target';
import {Runner, Step} from './runner';
import * as BuildSession from './buildSession';
import {File} from './file';
import {createHash, Hash} from 'crypto';


export type TaskName = { type: string, name: string, [s: string]: string };

export var taskClasses = new Map<string, typeof Task>();
export function declareTask(options: { type: string }) {
  return function (constructor: typeof Task) {
    taskClasses.set(options.type, constructor);
  }
}

export function getTask(type: string) : typeof Task {
  return taskClasses.get(type);
}

export class Task {
  dependencies : Set<Task> = new Set<Task>();
  requiredBy : Set<Task> = new Set<Task>();
  name: TaskName;
  graph: Graph;
  sessionKey: string;


  classname: string; // on the prototype, see registerClass
  constructor(name: TaskName, graph: Graph) {
    this.name = name;
    this.graph = graph;
    if (graph)
      this.graph.inputs.add(this);
  }
  
  /** fill the hash with data that can identify the task and its settings accross sessions
   * returns false if the task can't reuse previous run informations  */
  uniqueKey(hash: Hash) : boolean {
    return false;
  }

  /** returns the unique identifier of the task, this identifier is valid accross sessions */
  id() {
    if(this.sessionKey === undefined) {
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
    var task = this.graph;
    var cls = require('./Target');
    while (task && !(task instanceof cls))
      task = task.graph;
    return <any>task;
  }

  /** returns the absolute data storage path of the given task */
  storagePath(task: Task) {
    return this.graph && this.graph.storagePath(task);
  }
  
  isInstanceOf(classname: string) {
    return (classname in taskClasses && this instanceof taskClasses[classname]);
  }

  addDependencies(tasks : Task[]) {
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

  root() : Graph {
    var graph = this.graph;
    while(graph && graph.graph)
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
    switch(step.runner.action) {
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
               step.continue();}
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

