import {
  ComponentElement, Target, Element, Reporter, AttributePath, AttributeTypes, MakeJS, Project, injectElements
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

export class BuildTargetExportsElement extends TargetExportsElement {
  __target: Target;
  __generated: ComponentElement;

  constructor(target: Target, name: string) {
    super('target-exports', name, target.environment);
    this.__generated = new ComponentElement('component', 'generated', this);
    this.__target = target;
    this.__resolved = !!target;
    this.components.push(this.__generated);
  }

  __resolve(reporter: Reporter) {
    throw new Error(`__resolve is disabled for BuildTargetExportsElement`);
  }

  __createGeneratedComponent(name: string) {
    let component = new ComponentElement('component', name, this.__generated);
    this.__generated.components.push(component);
    return component;
  }

  __serialize(reporter: Reporter) {
    return this.toJSON();
  }
}
