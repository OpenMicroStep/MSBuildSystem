import {Target, Graph, Step, File, BuildSession} from '../index.priv';
import {createHash} from 'crypto';

export abstract class Node {
  dependencies: Set<Node> = new Set<Node>();
  requiredBy: Set<Node> = new Set<Node>();
  name: Node.Name;
  graph: Graph | undefined;
  private sessionKey: string | undefined | null;

  constructor(name: Node.Name, graph: Graph | undefined) {
    this.name = name;
    this.graph = graph;
    this.sessionKey = undefined;
    if (graph)
      graph.inputs.add(this);
  }

  /** returns the target that contains this task */
  target() : Target {
    var task: Node | undefined = this;
    while (task && !(task instanceof Target))
      task = task.graph;
    if (!task)
      throw new Error("logic error: this task has no target associated");
    return task;
  }

  uniqueKey() : any {
    return undefined;
  }

  /** returns the unique identifier of the task, this identifier is valid accross sessions */
  id() : string | null {
    if (this.sessionKey === undefined) {
      this.sessionKey = null;
      let data = this.uniqueKey();
      if (data !== undefined) {
        var shasum = createHash('sha1');
        shasum.update(JSON.stringify(data)); // TODO: use a stable stringify
        this.sessionKey = this.constructor.name + "-" + shasum.digest('hex');
      }
    }
    return this.sessionKey;
  }

  addDependencies(tasks: Node[]) {
    tasks.forEach((task) => { this.addDependency(task); });
  }
  addDependency(task: Node) {
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

  iterateDependencies(deep: boolean = false, shouldIContinue?: (task: Node, lvl: number) => boolean) {
    var end = false;
    var iterated = new Set<Node>();
    var iterate = (t: Node, lvl: number) => {
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

  root() : Graph | undefined {
    var graph = this.graph;
    while (graph && graph.graph)
      graph = graph.graph;
    return graph;
  }

  parents() : Graph[] {
    let parents = <Graph[]>[];
    let parent = this.graph;
    while (parent) {
      parents.push(parent);
      parent = parent.graph;
    }
    return parents;
  }

  getStorage() : BuildSession.BuildSession {
    return BuildSession.noop;
  }

  toString() {
    return this.name.type + ":" + this.name.name;
  }

  abstract do(step: Step<{}>);
  listOutputFiles(set: Set<File>) {}
}
export namespace Node {
  export type Name = { type: string, name: string, [s: string]: string };
}
