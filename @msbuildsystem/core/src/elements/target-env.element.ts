import {
  Element, ComponentElement, EnvironmentElement, MakeJSElement, TargetElement,
  Reporter, AttributeTypes, AttributePath, RootGraph,
  injectElement, createInjectionContext,
} from '../index.priv';

export class BuildTargetElement extends MakeJSElement {
  environment: EnvironmentElement;
  compatibleEnvironments: string[];
  targets: string[];
  components: Set<ComponentElement>;
  exports: ComponentElement[];
  type: string;
  __target: TargetElement;
  ___root: RootGraph;

  static notInjectedKeys = new Set(["tags", "elements"]);

  constructor(reporter: Reporter, root: RootGraph, target: TargetElement, environment: EnvironmentElement) {
    super('build-target', target.name, target.__parent!); // the parent is the same as the target to have the same resolution behavior
    this.is = 'build-target';
    this.environment = environment;
    //
    this.targets = [];
    this.components = new Set();
    this.exports = [];
    this.__target = target;
    this.___root = root;

    let ctx = createInjectionContext(reporter, this, true);
    injectElement(ctx, environment, new AttributePath(environment), this, new AttributePath(this));
    injectElement(ctx, target     , new AttributePath(target     ), this, new AttributePath(this));

    let at = new AttributePath(this, '');
    this.type = AttributeTypes.validateString.validate(reporter, at.set('.type'), this.type) || "bad type";
    this.targets = ComponentElement.setAsListValidator(AttributeTypes.validateString).validate(reporter, at.set('.targets'), this.targets) || [];
  }

  __path() {
    return `${super.__path()}{${this.environment.name}}`;
  }
}
Element.registerAttributes(BuildTargetElement, ["environment", "compatibleEnvironments", "targets", "components", "exports", "type"], {});
