import {
  Project, Element, ComponentElement, EnvironmentElement, MakeJSElement,
  Reporter, MakeJS, PathReporter, AttributeTypes,
} from '../index.priv';

Project.elementFactories.registerSimple('target', (at: PathReporter, name: string, definition: MakeJS.Target, parent: MakeJSElement) => {
  if (!name) {
    at.diagnostic({ is: "warning", msg: `target element must have a name` });
    return undefined;
  }
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

  __resolveWithPath(at: PathReporter) {
    super.__resolveWithPath(at);
    this.environments = this.__resolveEnvironments(at.reporter, this, []);
  }

  __resolveEnvironments(reporter: Reporter, component: ComponentElement, into: EnvironmentElement[]) {
    let envs = component['environments'];
    if (envs)
      into.push(...validateEnvList.validate(new PathReporter(reporter, component, '.environments'), envs));
    if ("environmentsByEnvironment" in component) {
      reporter.diagnostic({
        is: "warning",
        msg: `attribute has no meaning (you can't extends environments after one is selected)`,
        path: `${(component as ComponentElement).__path()}.environmentsByEnvironment`
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
        is: "error",
        msg: `no compatible environment found for target '${this.name}' with build environment '${environment.name}'`,
        path: `${this.__path()}.targets`
      });
    }
    else if (compatibleEnvs.length > 1) {
      reporter.diagnostic({
        is: "error",
        msg: `multiple compatible environments found for target '${this.name}' with build environment '${environment.name}'`,
        path: `${this.__path()}.targets`
      });
    }
    else return compatibleEnvs[0];
    return null;
  }
}
