import {
  Graph, Node, Step, BuildSession, TaskDoMapReduce, Target,
  createProviderMap, ProviderMap, Reporter, AttributePath, AttributeTypes
} from '../index.priv';

export class Task extends Node {
  static declare(names: string[]) : (cstor: { new (name: string, graph: Graph): Task }) => void;
  static declare<A>(names: string[], attributes: AttributeTypes.Extensions<A, Target> ) : (cstor: { new (name: string, graph: Graph, attributes: A): Task }) => void;
  static declare(names: string[], attributes?: AttributeTypes.Extension<any, Target>) {
    return function register(cstor: { new (name: string, graph: Graph): Task }) {
      Task.providers.register(names, cstor);
    };
  }
  static providers = createProviderMap<{ new (name: string, graph: Graph): Task }>('tasks');
  static register(names: string[], cstor: { new (name: string, graph: Graph): Task }, attributes?: {}) {
    Task.providers.register(names, cstor);
  }

  static generators = createProviderMap<TaskDoMapReduce<any, any>>('generator');

  graph: Graph;

  constructor(name: Node.Name, graph: Graph) {
    super(name, graph);
  }

  configure(attributes: {}) : void {}

  /** returns the unique and reusable accross session data storage of this task */
  getStorage() : BuildSession.BuildSession {
    var p = this.storagePath(this);
    return p ? new BuildSession.FastJSONDatabase(p) : BuildSession.noop;
  }


  /** returns the absolute data storage path of the given task */
  storagePath(task: Node) : string | undefined {
    return this.graph.storagePath(task);
  }

  do(step: Step<{ actionRequired?: boolean }>) {
    step.setFirstElements([
      (step) => {
        step.context.actionRequired = true;
        this.isActionRequired(step);
      },
      (step) => {
        if (step.context.reporter.failed)
          step.continue();
        else if (step.context.actionRequired)
          this.doRequiredAction(step);
        else {
          step.context.reporter.logs = step.context.data.logs || "";
          step.context.reporter.diagnostics = step.context.data.diagnostics || [];
          step.continue();
        }
      }
    ]);
    step.continue();
  }

  isActionRequired(step: Step<{ actionRequired?: boolean }>) {
    if (!step.context.runner.options.full && step.context.lastSuccessTime > 0) {
      let m = `is_${step.context.runner.action}_required`;
      let method = this[m];
      if (typeof method === 'function')
        step.setFirstElements(step => this[m](step));
    }
    step.continue();
  }

  doRequiredAction(step: Step<{}>) {
    let m = `do_${step.context.runner.action}`;
    let method = this[m];
    if (typeof method === 'function') {
      this[m](step);
    }
    else {
      step.context.reporter.diagnostic({
        type: "note",
        msg: `task doesn't support "${step.context.runner.action}" action`,
        path: this.toString()
      });
      step.continue();
    }
  }

  do_generate(step: Step<{ value?: any }>) {
    let what = step.context.runner.options['ide'];
    let method = `do_generate_${what}`;
    if (typeof this[method] === "function")
      this[method](step);
    else
      step.continue();
  }
}

export namespace Task {
  export type Actions = { [s: string]: Action };
  export type Action = { name: string };
}

