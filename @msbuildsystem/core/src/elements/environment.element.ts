import {Element, ComponentElement, Reporter, MakeJS, AttributeTypes, AttributePath, Project} from '../index.priv';

Project.elementFactories.registerSimple('environment', (reporter: Reporter, name: string,
  definition: MakeJS.Environment, attrPath: AttributePath, parent: Element
) => {
  return new EnvironmentElement(name, parent);
});
export class EnvironmentElement extends ComponentElement {
  static validate = Element.elementValidator('environment', EnvironmentElement);

  compatibleEnvironments: string[];

  constructor(name: string, parent: Element) {
    super('environment', name, parent);
    this.compatibleEnvironments = [];
  }
}
