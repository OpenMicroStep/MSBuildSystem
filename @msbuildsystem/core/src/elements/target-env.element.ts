import {
  Element, ComponentElement, EnvironmentElement, MakeJSElement, TargetElement,
  Reporter, AttributeTypes, AttributePath, RootGraph, TargetExportsDefinition,
  injectElement, createInjectionContext, InjectionContext, closeInjectionContext,
} from '../index.priv';

const validateStringList = ComponentElement.setAsListValidator(AttributeTypes.validateString);

export class BuildTargetElement extends MakeJSElement {
  manual: boolean;
  environment: EnvironmentElement;
  compatibleEnvironments: string[];
  targets: string[];
  components: Set<ComponentElement>;
  exports: TargetExportsDefinition;
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
    this.__target = target;
    this.___root = root;

    let ctx = createInjectionContext(reporter, this);
    let keep = ctx.keep;
    let copy = ctx.copy;
    ctx.keep = (ctx, attr) => {
      if (ctx.lpath.startsWith('[exports]'))
        return Element.isNamespace(attr) || attr === 'components' || keep(ctx, attr);
      else
        return keep(ctx, attr);
    };
    ctx.deep = (ctx, kind) => !(kind === 'components' && ctx.lpath.startsWith('[exports]'));
    ctx.copy = (ctx, attr) => copy(ctx, attr) && !(ctx.lpath.startsWith('[exports]') && Element.isNamespace(attr));
    injectElement(ctx, environment, new AttributePath(environment), this, new AttributePath(this));
    injectElement(ctx, target     , new AttributePath(target     ), this, new AttributePath(this));
    closeInjectionContext(ctx);

    let atexports = new AttributePath(this, '.exports');
    let exports = new Set<Element>();
    ComponentElement.superValidateList(reporter, atexports, this.exports as any, undefined, Element.validateElement, exports.add.bind(exports));
    let serialized_exports = [...exports].map(e => e.toJSON());
    this.exports = {
      is: "target-exports",
      name: this.name,
      environment: this.environment.name,
      components: ["=generated", ...serialized_exports],
      "generated=": { is: "component",
        targets: [this.name],
        components: [],
      }
    };

    let at = new AttributePath(this, '');
    this.type = AttributeTypes.validateString.validate(reporter, at.set('.type'), this.type) || "bad type";
    this.targets = validateStringList.validate(reporter, at.set('.targets'), this.targets) || [];
    this.manual = AttributeTypes.defaultsTo(AttributeTypes.validateBoolean, false).validate(reporter, at.set('.manual'), this.manual);
  }

  __path() {
    return `${super.__path()}{${this.environment.name}}`;
  }
}
Element.registerAttributes(BuildTargetElement, ["environment", "compatibleEnvironments", "targets", "components", "exports", "type", "manual"], {});
