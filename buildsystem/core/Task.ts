import Graph = require('./Graph');
import Target = require('./Target');
import events = require('events');
import Runner = require('./Runner');
import BuildSession = require('./BuildSession');
import util = require('util');
import crypto = require('crypto');
import File = require('./File');

var __id_counter: number = 0;

var classes = {};

class Task extends events.EventEmitter {
  dependencies : Set<Task> = new Set<Task>();
  requiredBy : Set<Task> = new Set<Task>();
  name: Task.Name;
  graph: Graph;
  sessionKey: string;

  classname: string; // on the prototype, see registerClass
  constructor(name: Task.Name, graph: Graph) {
    super();
    this.name = name;
    this.graph = graph;
    if(this.graph) {
      this.graph.inputs.add(this);
    }
    if (!this.classname)
      Task.registerClass(this.constructor, this.constructor.name);
  }
  static registerClass(cls, taskTypeName: string) {
    if(taskTypeName) {
      console.debug("Task '%s' registed (raw name='%s')", taskTypeName, cls.name);
      classes[taskTypeName] = cls;
      cls.prototype.classname = taskTypeName;
    }
  }
  static findTask(taskTypeName: string) {
    return classes[taskTypeName];
  }
  isInstanceOf(classname: string) {
    return (classname in classes && this instanceof classes[classname]);
  }

  addDependencies(tasks : Array<Task>) {
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

  target() : Target {
    var task = this.graph;
    var cls = require('./Target');
    while (task && !(task instanceof cls))
      task = task.graph;
    return <any>task;
  }

  uniqueKey(): string { return "__" + (++__id_counter).toString(); }

  id() {
    if(this.sessionKey === undefined) {
      this.sessionKey = null;
      var key = this.uniqueKey();
      if (key) {
        var shasum = crypto.createHash('sha1');
        shasum.update(key);
        this.sessionKey = this.classname + "-" + shasum.digest('hex');
      }
    }
    return this.sessionKey;
  }

  root() : Graph {
    var graph = this.graph;
    while(graph && graph.graph)
      graph = graph.graph;
    return graph;
  }

  getStorage() : BuildSession {
    var p = this.storagePath(this);
    return p ? new BuildSession.FastJSONDatabase(p) : BuildSession.noop;;
  }

  storagePath(task: Task) {
    return this.graph.storagePath(task);
  }

  listDependenciesOutputFiles(set: Set<File>) {
    this.dependencies.forEach((t) => {
      t.listOutputFiles(set);
      t.listDependenciesOutputFiles(set);
    });
  }

  listOutputFiles(set: Set<File>) { }

  do(step: Runner.Step) {
    switch(step.runner.action) {
      case "build":
        this.isRunRequired(step, (err, required) => {
          if (err) {
            step.error(err);
            step.continue();
          }
          else if (required) {
            this.run(step);
          }
          else {
            step.log(step.data.logs);
            step.continue();
          }
        });
        break;

      case "clean":
        this.clean(step);
        break;

      default:
        step.continue();
        break;
    }
  }

  isRunRequired(step: Runner.Step, callback: (err, required:boolean) => any) {
    callback(null, true);
  }

  run(step: Runner.Step) {
    step.error("'run' must be reimplemented by subclasses");
    step.continue();
  }
  clean(step: Runner.Step) {
    step.continue();
  }

  toString() {
    return this.name.type + ":" + this.name.name;
  }
  description() {
    return this.toString();
  }
}

module Task {
  export type Name = { type: string, name: string, [s: string]: string };
}
export = Task;