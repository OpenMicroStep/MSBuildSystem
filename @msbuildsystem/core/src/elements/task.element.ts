import {Element, ComponentElement, Reporter, MakeJS, AttributeTypes, AttributePath, Project, Graph, Target, Task, Node} from '../index.priv';

const factory = (reporter: Reporter, name: string,
  definition: MakeJS.Environment, attrPath: AttributePath, parent: Element
) => {
  return new TaskElement(name, parent);
};
Project.elementFactories.registerSimple('task', factory);
Project.elementExportsFactories.registerSimple('task', factory);
export class TaskElement extends ComponentElement {
  static validate = Element.elementValidator('task', TaskElement);
  type: Task.Constructor<any, any> | undefined;

  constructor(name: string, parent: Element) {
    super('task', name, parent);
  }
}
Element.registerAttributes(TaskElement, [], {
  type: Task.providers.validate
});
export namespace TaskElement {
  const validateAsTask: AttributeTypes.Validator<Task, Graph> = {
    validate(reporter: Reporter, path: AttributePath, value: any, graph: Graph) : Task | undefined {
      let e = TaskElement.validate.validate(reporter, path, value);
      let cstor = e && e.type;
      let v = cstor && cstor.prototype.__validator;
      let attrs = v && v.validate(reporter, path, e, graph.target());
      let task = cstor && new cstor(e!.name, graph, attrs);
      return task;
    }
  };
  const validateArrayOfTask = AttributeTypes.listValidator(validateAsTask);
  const validateTaskOrArrayOfTask: AttributeTypes.Validator<Node, Graph> = {
    validate(reporter: Reporter, path: AttributePath, taskOrArray: any, graph: Graph) : Node | undefined {
      if (Array.isArray(taskOrArray)) {
        let g = new Graph({ type: "graph", name: "tasks" }, graph);
        validateArrayOfTask.validate(reporter, path, taskOrArray, g);
        return g;
      }
      else {
        return validateAsTask.validate(reporter, path, taskOrArray, graph);
      }
    }
  };
  const validateArrayOf = AttributeTypes.listValidator(validateTaskOrArrayOfTask);
  export const validateTaskSequence: AttributeTypes.ValidatorT<Graph, Target> = {
    validate: function validateArray(reporter: Reporter, path: AttributePath, attr: any, target: Target) {
      let graph = new Graph({ type: "graph", name: "tasks" }, target);
      let tasks = validateArrayOf.validate(reporter, path, attr, graph);
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
