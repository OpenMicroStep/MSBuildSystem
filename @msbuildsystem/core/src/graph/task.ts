import {
  Graph, Node, Step, BuildSession, TaskDoMapReduce, Target,
  createProviderMap, ProviderMap, Reporter, AttributePath, AttributeTypes, TaskElement
} from '../index.priv';

function taskValidator<T extends object>(extensions: AttributeTypes.ExtensionsNU<T, Target>, map: Task.Map<any, any>) : AttributeTypes.ValidatorT<object, Target> {
  function validateObject(reporter: Reporter, path: AttributePath, attr: TaskElement, target) {
    return map(reporter, AttributeTypes.superValidateObject(reporter, path, attr, target, {}, extensions, { validate(reporter: Reporter, at: AttributePath, value: any, a0: string) : undefined {
        if (!attr.__keyMeaning(a0))
          at.diagnostic(reporter, { type: "warning", msg: `attribute is unused` });
        return undefined;
      }}));
  };
  return { validate: validateObject, traverse: (lvl, ctx) => `object with` };
}

export class Task extends Node {
  readonly __extensions: AttributeTypes.Extension<Partial<Target>, Target>; // on the prototype
  readonly __validator: AttributeTypes.ValidatorNU<object, Target>;

  static declare<T extends Task, A>(names: string[], attributes: AttributeTypes.ExtensionsNU<Partial<A>, Target>) : (cstor: Task.Constructor<T, A>) => void;
  static declare<T extends Task, OA, MA>(names: string[], attributes: AttributeTypes.ExtensionsNU<OA, Target>, map: Task.Map<OA, MA>) : (cstor: Task.Constructor<T, MA>) => void;
  static declare<T extends Task, OA, MA>(names: string[], attributes: AttributeTypes.ExtensionsNU<OA, Target>, map?: Task.Map<OA, MA>) {
    return function register(cstor: Task.Constructor<T, MA>) {
      Task.register(names, cstor, attributes);
    };
  }
  static providers = createProviderMap<Task.Constructor<any, any>>('tasks');

  static register<T extends Task, A>(names: string[], cstor: Task.Constructor<T, A>, attributes: AttributeTypes.ExtensionsNU<A, Target>): void;
  static register<T extends Task, OA, MA>(names: string[], cstor: Task.Constructor<T, MA>, attributes: AttributeTypes.ExtensionsNU<OA, Target>, map?: Task.Map<OA, MA>): void;
  static register<T extends Task, OA, MA>(names: string[], cstor: Task.Constructor<T, MA>, attributes: AttributeTypes.ExtensionsNU<OA, Target>, map?: Task.Map<OA, MA>) {
    Task.providers.register(names, cstor);
    let p = cstor.prototype;
    if (p.hasOwnProperty('__extensions') || p.hasOwnProperty('__validator'))
      throw new Error(`registerAttributes can only be called once per SelfBuildGraph class`);

    let extensions = p.__extensions ? { ...p.__extensions, ...attributes as object } : (attributes || {});
    Object.defineProperties(p, {
      __extensions: { enumerable: false, writable: false, value: extensions },
      __validator: { enumerable: false, writable: false, value: taskValidator(extensions, map || ((reporter, a) => a)) },
    });
  }

  static generators = createProviderMap<TaskDoMapReduce<any, any>>('generator');

  graph: Graph;

  constructor(name: Node.Name, graph: Graph) {
    super(name, graph);
  }

  configure(reporter: Reporter, attributes: {}) : void {}

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
        this.isActionRequired(step);
      },
      (step) => {
        if (step.context.runner.options.full) {
          step.context.lastSuccessStartTime = 0;
          step.context.lastSuccessEndTime = 0;
        }
        if (step.context.reporter.failed)
          step.continue();
        else if (step.context.actionRequired || step.context.lastSuccessStartTime === 0)
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
    step.context.actionRequired = true;
    let m = `is_${step.context.runner.action}_required`;
    let method = this[m];
    if (typeof method === 'function')
      step.setFirstElements(step => this[m](step));
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
  export type Map<OA, MA> = (reporter: Reporter, oa: OA) => MA;
  export type Constructor<T extends Task, A> = {
    new (name: string, graph: Graph, attributes: A): Task,
    prototype: T
  };
  export type Actions = { [s: string]: Action };
  export type Action = { name: string };
}

