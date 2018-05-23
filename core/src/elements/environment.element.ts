import {Element, ComponentElement, Reporter, MakeJS, AttributeTypes, PathReporter, Project, DelayedQuery} from '../index.priv';

Project.elementFactories.registerSimple('environment', (at: PathReporter, name: string,
  definition: MakeJS.Environment, parent: Element
) => {
  return new EnvironmentElement(name, parent);
});
Project.elementExportsFactories.registerSimple('environment', (at: PathReporter, name: string,
  definition: MakeJS.Environment, parent: Element
) => {
  at.diagnostic({ is: "error", msg: "environment elements cannot be exported" });
  return undefined;
});
export class EnvironmentElement extends ComponentElement {
  static validate: AttributeTypes.ValidatorT0<EnvironmentElement>;
  compatibleEnvironments: string[];

  constructor(name: string, parent: Element) {
    super('environment', name, parent);
    this.compatibleEnvironments = [];
  }
}
const validateEnvironment = Element.elementValidator('environment', EnvironmentElement);
const validate = Object.assign(AttributeTypes.chain(
  Element.validateElement,
  { validate(at, value: Element) {
    if (value instanceof DelayedQuery) {
      at.diagnostic({ is: "warning", msg: `attribute must be a 'environment' element, got a delayed query '${value.__path()}'`});
      return undefined;
    }
    return value;
  }}, validateEnvironment), { traverse: validateEnvironment.traverse.bind(validateEnvironment)}
);
EnvironmentElement.validate = validate;
