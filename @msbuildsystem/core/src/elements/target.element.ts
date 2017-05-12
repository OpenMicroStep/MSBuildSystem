import {
  Project, Element, ComponentElement, EnvironmentElement, MakeJSElement,
  Reporter, MakeJS, AttributePath, AttributeTypes,
} from '../index.priv';

Project.elementFactories.registerSimple('target', (reporter: Reporter, name: string, definition: MakeJS.Target, attrPath: AttributePath, parent: MakeJSElement) => {
  let target = new TargetElement(name, parent);
  parent.__root().__project().targets.push(target);
  return target;
});
const validateEnvList = AttributeTypes.listValidator(EnvironmentElement.validate);
export class TargetElement extends ComponentElement {
  static validate = Element.elementValidator('target', TargetElement);

  environments: EnvironmentElement[];
  exports: ComponentElement[];
  exportsByEnvironment: { [s: string]: ComponentElement[] };

  constructor(name: string, parent: Element) {
    super('target', name, parent);
    this.exports = [];
    this.exportsByEnvironment = {};
    this.environments = [];
  }

  __resolveWithPath(reporter: Reporter, attrPath: AttributePath) {
    super.__resolveWithPath(reporter, attrPath);
    this.environments = this.__resolveEnvironments(reporter, this, []);
  }

  __resolveEnvironments(reporter: Reporter, component: ComponentElement, into: EnvironmentElement[]) {
    let envs = component['environments'];
    if (envs)
      into.push(...validateEnvList.validate(reporter, new AttributePath(component, '.environments'), envs));
    if ("environmentsByEnvironment" in component) {
      reporter.diagnostic({
        type: "warning",
        msg: `attribute has no meaning (you can't extends environments after one is selected)`,
        path: `${component.__path()}.environmentsByEnvironment`
      });
    }
    component.components.forEach(c => c.is === 'component' && this.__resolveEnvironments(reporter, c, into));
    return into;
  }

  __compatibleEnvironment(reporter: Reporter, environment: {name: string, compatibleEnvironments: string[]}) : EnvironmentElement | null {
    let compatibleEnvs = this.environments.filter(e =>
      e.name === environment.name ||
      environment.compatibleEnvironments.indexOf(e.name) !== -1
    );
    if (compatibleEnvs.length === 0) {
      reporter.diagnostic({
        type: "error",
        msg: `no compatible environment found for target '${this.name}' with build environment '${environment.name}'`,
        path: `${this.__path()}.targets`
      });
    }
    else if (compatibleEnvs.length > 1) {
      reporter.diagnostic({
        type: "error",
        msg: `multiple compatible environments found for target '${this.name}' with build environment '${environment.name}'`,
        path: `${this.__path()}.targets`
      });
    }
    else return compatibleEnvs[0];
    return null;
  }
}
