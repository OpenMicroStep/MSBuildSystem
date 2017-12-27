import {Element, ComponentElement, Reporter, MakeJS, AttributeTypes, PathReporter, Project, Graph, Target, Task, Node} from '../index.priv';

const factory = (at: PathReporter, name: string,
  definition: MakeJS.Environment, parent: Element
) => {
  return new TaskElement(name, parent);
};
Project.elementFactories.registerSimple('task', factory);
Project.elementExportsFactories.registerSimple('task', factory);
export class TaskElement extends ComponentElement {
  static validate = Element.elementValidator('task', TaskElement);
  type: string | undefined;

  constructor(name: string, parent: Element) {
    super('task', name, parent);
  }

  __keyMeaning(attr) {
    return attr === "type" ? Element.KeyMeaning.Element : super.__keyMeaning(attr);
  }
}
export namespace TaskElement {
  const validateAsTask: AttributeTypes.Validator<Task, Graph> = {
    validate(at: PathReporter, value: any, graph: Graph) : Task | undefined {
      let e = TaskElement.validate.validate(at, value);
      let cstor = e && e.type ? Task.providers.validate.validate(at, e.type) : undefined;
      let v = cstor && cstor.prototype.__validator;
      let attrs = v && v.validate(at, e, graph.target());
      let task = cstor && new cstor(e!.name, graph, attrs);
      return task;
    }
  };
  const validateArrayOfTask = AttributeTypes.listValidator(validateAsTask);
  const validateTaskOrArrayOfTask: AttributeTypes.Validator<Node, Graph> = {
    validate(at: PathReporter, taskOrArray: any, graph: Graph) : Node | undefined {
      if (Array.isArray(taskOrArray)) {
        let g = new Graph({ type: "graph", name: "tasks" }, graph);
        validateArrayOfTask.validate(at, taskOrArray, g);
        return g;
      }
      else {
        return validateAsTask.validate(at, taskOrArray, graph);
      }
    }
  };
  const validateArrayOf = AttributeTypes.listValidator(validateTaskOrArrayOfTask);
  export const validateTaskSequence: AttributeTypes.ValidatorT<Graph, Target> = {
    validate: function validateArray(at: PathReporter, attr: any, target: Target) {
      let graph = new Graph({ type: "graph", name: "tasks" }, target);
      let tasks = validateArrayOf.validate(at, attr, graph);
      let p: Node | undefined = undefined;
      for (let t of tasks) {
        if (p)
          t.addDependency(p);
        p = t;
      }
      return graph;
    },
    traverse() {
      return `array of tasks`;
    }
  };
}
