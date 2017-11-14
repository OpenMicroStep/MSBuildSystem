import {
  ComponentElement, Target, Element, Reporter, AttributePath, AttributeTypes, MakeJS, Project, ElementDefinition
} from '../index.priv';

function createExportsComponent(reporter: Reporter, name: string,
  definition: MakeJS.Element, attrPath: AttributePath, parent: Element
) {
  let env = AttributeTypes.validateString.validate(reporter, attrPath, definition.environment);
  return env ? new TargetExportsElement('component', name, env) : undefined;
}
Project.elementExportsFactories.registerSimple('target-exports', createExportsComponent);
export class TargetExportsElement extends ComponentElement {
  __target: Target | null;
  __generated: ComponentElement;
  environment: string;

  constructor(is: string, name: string, environment: string) {
    super(is, name, null);
    this.environment = environment;
  }

  __path() {
    return `${this.name}{${this.environment}}.exports`;
  }
}

export type TargetExportsDefinition = {
  is: "target-exports";
  name: string;
  environment: string;
  components: (ElementDefinition | string)[];
  "generated=": { is: "component", targets: [string], components: ElementDefinition[] }
}
