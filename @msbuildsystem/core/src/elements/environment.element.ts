import {Element, declareElementFactory, ComponentElement, Reporter, MakeJS, AttributeResolvers, AttributePath} from '../index.priv';

declareElementFactory('environment', (reporter: Reporter, name: string,
  definition: MakeJS.Environment, attrPath: AttributePath, parent: Element
) => {
  return [new EnvironmentElement(name, parent)];
});
export class EnvironmentElement extends ComponentElement {
  compatibleEnvironments: string[];

  constructor(name: string, parent: Element) {
    super('environment', name, parent);
    this.__project().environments.push(this);
    this.compatibleEnvironments = [];
  }

  __loadReservedValue(reporter: Reporter, key: string, value, attrPath: AttributePath) {
    if (key === 'compatibleEnvironments') {
      this.compatibleEnvironments = AttributeResolvers.stringListResolver.resolve(reporter, value, attrPath);
    }
    else {
      super.__loadReservedValue(reporter, key, value, attrPath);
    }
  }
}
