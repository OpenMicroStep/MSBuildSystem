import {
  Element, DelayedElement, ComponentElement, EnvironmentElement, MakeJSElement, TargetExportsElement, TargetElement,
  Reporter, AttributeTypes, AttributePath, RootGraph
} from '../index.priv';

const notInjectableKeys = /(^__)|([^\\]=$)|tags|elements/;

export class BuildTargetElement extends MakeJSElement {
  variant: string;
  environment: EnvironmentElement;
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
    this.__injectElements(reporter, [target]);
    // inject the environment
    this.__injectElements(reporter, [this.environment]);
    // inject components tree
    let components = new Set<ComponentElement>();
    this.__injectComponents(reporter, this, components);
    this.components = Array.from(components);

    let at = new AttributePath(this, '');
    this.type = AttributeTypes.validateString(reporter, at.set('.type'), this.type) || "bad type";
    this.targets = AttributeTypes.validateStringList(reporter, at.set('.targets'), this.targets) || [];
  }

  __injectElements(reporter: Reporter, elements: Element[]) {
    let keysWithSimpleValue = new Set<string>();
    for (let depcomponent of elements) {
      let at = new AttributePath(depcomponent, '.', '');
      for (let key in depcomponent) { if (notInjectableKeys.test(key)) continue;
        let cvalue = this[key];
        let dvalue = depcomponent[key];
        let byenv = key.endsWith("ByEnvironment");
        at.set(key, -2);
        if (byenv) {
          let cFinalKey = key.substring(0, key.length - "ByEnvironment".length);
          let cFinalValue = this[cFinalKey];
          if (cFinalValue !== undefined && !Array.isArray(cFinalValue)) {
            at.diagnostic(reporter, {
              type: "warning",
              msg: `attribute value is incoherent for injection into ${this.__path()}, '${cFinalKey}' must be an array, attribute is ignored`
            });
          }
          else {
            if (cFinalValue === undefined)
              cFinalValue = this[cFinalKey] = [];
            at.push('[', '', ']');
            for (var query in dvalue) {
              var envs = this.resolveElements(reporter, query);
              if (envs.indexOf(this.environment) !== -1) {
                var v = dvalue[query];
                at.set(query, -2);
                if (Array.isArray(v)) {
                  mergeArrays(reporter, this, at, cFinalValue, v);
                }
                else {
                  at.diagnostic(reporter, {
                    type: "warning",
                    msg: "attribute must contain an array"
                  });
                }
              }
            }
            at.pop(3);
          }
        }
        else {
          let cvalueIsArr = cvalue ? Array.isArray(cvalue) : false;
          let dvalueIsArr = dvalue ? Array.isArray(dvalue) : false;
          if (cvalue !== undefined && cvalueIsArr !== dvalueIsArr) {
            at.diagnostic(reporter, {
              type: "warning",
              msg: `attribute value is incoherent for injection into ${this.__path()}, attribute is ignored`
            });
          }
          else if (dvalueIsArr) {
            if (!cvalue)
              cvalue = this[key] = [];
            mergeArrays(reporter, this, at, cvalue, dvalue);
          }
          else if (keysWithSimpleValue.has(key)) {
            at.diagnostic(reporter, {
              type: "warning",
              msg: `attribute value is incoherent for injection into ${this.__path()}, attribute is removed`
            });
            delete this[key];
          }
          else if (cvalue === undefined) {
            keysWithSimpleValue.add(key);
            this[key] = dvalue;
          }
        }
      }
    }
  }

  __injectComponents(reporter: Reporter, current: { components: ComponentElement[] }, injected: Set<ComponentElement>) {
    if (current !== this)
      injected.add(<ComponentElement>current);
    if (current.components) {
      this.__injectElements(reporter, current.components);
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

function mergeArrays(reporter: Reporter, buildTarget: BuildTargetElement, at: AttributePath, into: any[], from: any[]) {
  at.push('[', '', ']');
  for (var i = 0, len = from.length; i < len; i++) {
    var c = from[i];
    if (c instanceof DelayedElement)
      into.push(...<ComponentElement[]>c.__delayedResolve(reporter, buildTarget, at.set(i, -2)));
    else
      into.push(c);
  }
  at.pop(3);
}
