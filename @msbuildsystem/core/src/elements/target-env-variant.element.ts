import {
  ComponentElement, EnvironmentElement, MakeJSElement, TargetElement, TargetExportsElement,
  Reporter, AttributeTypes, AttributePath, RootGraph
} from '../index.priv';
import {injectElements} from './injection';

export class BuildTargetElement extends MakeJSElement {
  variant: string;
  environment: EnvironmentElement;
  environments: EnvironmentElement[];
  targets: string[];
  components: ComponentElement[];
  exports: ComponentElement[];
  type: string;
  __target: TargetElement;
  ___root: RootGraph;

  static notInjectedKeys = new Set(["tags", "elements"]);

  constructor(reporter: Reporter, root: RootGraph, target: TargetElement, environment: EnvironmentElement, variant: string) {
    super('build-target', target.name, target.__parent!); // the parent is the same as the target to have the same resolution behavior
    // setup the is, variant and environment attributes
    this.is = 'build-target';
    this.variant = variant;
    this.environment = environment;
    //
    this.targets = [];
    this.components = [];
    this.exports = [];
    this.__target = target;
    this.___root = root;
    // inject target element attributes to itself
    let at = new AttributePath(this, '');
    injectElements(reporter, [target], this, at, this);
    this.environments = target.environments;
    // inject the environment
    injectElements(reporter, [this.environment], this, at, this);
    // inject components tree
    let components = new Set<ComponentElement>();
    this.__injectComponents(reporter, this, components);
    this.components = Array.from(components);

    this.type = AttributeTypes.validateString(reporter, at.set('.type'), this.type) || "bad type";
    this.targets = AttributeTypes.validateStringList(reporter, at.set('.targets'), this.targets) || [];
  }

  __injectComponents(reporter: Reporter, current: { components: ComponentElement[] }, injected: Set<ComponentElement>) {
    if (current !== this)
      injected.add(<ComponentElement>current);
    if (current.components) {
      injectElements(reporter, current.components, this, new AttributePath(this), this);
      for (var component of current.components)
        this.__injectComponents(reporter, component, injected);
    }
  }

  __path() {
    return `${super.__path()}{${this.variant}/${this.environment.name}}`;
  }

  __resolveDelayedExports(reporter: Reporter, target: TargetElement, environment: {name: string, compatibleEnvironments: string[]}) {
    let compatibleEnv = target.__compatibleEnvironment(reporter, environment);
    if (compatibleEnv) {
      let realTarget = this.___root.createTarget(reporter, this, target, compatibleEnv, this.variant);
      if (realTarget)
        return realTarget.exports;
    }
    return null;
  }
}
