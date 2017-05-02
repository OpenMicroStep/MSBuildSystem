import {Element, ComponentElement, Reporter, MakeJS, AttributeTypes, AttributePath, Project, DelayedQuery} from '../index.priv';

Project.elementFactories.registerSimple('environment', (reporter: Reporter, name: string,
  definition: MakeJS.Environment, attrPath: AttributePath, parent: Element
) => {
  return new EnvironmentElement(name, parent);
});
export class EnvironmentElement extends ComponentElement {
  compatibleEnvironments: string[];

  constructor(name: string, parent: Element) {
    super('environment', name, parent);
    this.compatibleEnvironments = [];
  }
}
const validateEnvironment = Element.elementValidator('environment', EnvironmentElement);
const validate = Object.assign(AttributeTypes.chain(
  Element.validateElement,
  { validate(reporter, path, value: Element) {
    if (value instanceof DelayedQuery) {
      path.diagnostic(reporter, { type: "warning", msg: `attribute must be a 'environment' element, got a delayed query '${value.__description()}'`});
      return undefined;
    }
    return value;
  }}, validateEnvironment), { traverse: validateEnvironment.traverse.bind(validateEnvironment)}
);
EnvironmentElement.validate = validate;
