import {declareSimpleElementFactory, elementValidator, validateElement, util,
  Element, DelayedElement, ComponentElement, EnvironmentElement,
  Reporter, MakeJS, AttributeTypes, AttributePath, RootGraph, Target
} from '../index.priv';

declareSimpleElementFactory('target', (reporter: Reporter, name: string, definition: MakeJS.Target, attrPath: AttributePath, parent: Element) => {
  let target = new TargetElement(name, parent);
  parent.__project().targets.push(target);
  return target;
});
export class TargetElement extends ComponentElement {
  environments: EnvironmentElement[];
  exports: ComponentElement[];
  exportsByEnvironment: { [s: string]: ComponentElement[] };

  constructor(name: string, parent: Element) {
    super('target', name, parent);
    this.exports = [];
    this.exportsByEnvironment = {};
    this.environments = [];
  }

  __loadReservedValue(reporter: Reporter, key: string, value, attrPath: AttributePath) {
    if (key === 'environments') {
      this.__loadIfArray(reporter, value, this.environments, attrPath);
    }
    else if (key === 'exports') {
      this.__loadIfArray(reporter, value, this.exports, attrPath);
    }
    else if (key === 'exportsByEnvironment') {
      this.__loadIfObject(reporter, value, this.exportsByEnvironment, attrPath);
    }
    else {
      super.__loadReservedValue(reporter, key, value, attrPath);
    }
  }

  __resolveValueForKey(reporter: Reporter, v, k: string, keepGroups: boolean, attrPath: AttributePath) {
    super.__resolveValueForKey(reporter, v, k, k === 'exports' || k === 'exportsByEnvironment', attrPath);
  }

  __resolve(reporter: Reporter) {
    super.__resolve(reporter);
    this.__resolveEnvironments(reporter);
  }

  __resolveEnvironments(reporter: Reporter) {
    this.environments = this.__validateElements<EnvironmentElement>(reporter, this.environments, 'environments', ['environment']);
    this.components.forEach(c => {
      this.environments.push(...this.__validateElements<EnvironmentElement>(reporter, c['environments'] || [], 'environments', ['environment']));
    });
    if ("environmentsByEnvironment" in this) {
      reporter.diagnostic({
        type: "warning",
        msg: `attribute has no meaning (you can't extends environments after one is selected)`,
        path: `${this.__path()}.environmentsByEnvironment`
      });
    }
  }

  __resolveComponents(reporter: Reporter) {
    this.components = this.__validateElements<ComponentElement>(reporter, this.components, 'components', ['component', 'delayed']);
    // postpone the injection of components until the final resolution
    // this is required because the components list may contain delayed elements
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

export const validateTargetElement = elementValidator('target', TargetElement);
const validateTargetList = AttributeTypes.listValidator<TargetElement | TargetExportsElement>(function (reporter: Reporter, path: AttributePath, value: any) {
  value = validateElement(reporter, path, value);
  if (value !== undefined && (value instanceof TargetElement || value instanceof TargetExportsElement))
    return value;
  if (value !== undefined)
    path.diagnostic(reporter, { type: "warning", msg: `attribute must be a 'target' element, got a ${value.is}`});
  return undefined;
});

function serialize(element) {
  if (typeof element === "object") {
    if (Array.isArray(element)) {
      return element.slice(0).map(e => serialize(e));
    }
    else {
      let k, v, copy = {};
      for (k in element) {
        if (!k.startsWith("__")) {
          v = element[k];
          copy[k] = serialize(v);
        }
      }
      return copy;
    }
  }
  return element;
}

export class TargetExportsElement extends ComponentElement {
  __target: Target | null;
  type: string;

  constructor(target: Target | null, name: string) {
    super('target exports', name, null);
    this.__target = target;
    this.__resolved = !!target;
  }

  resolveElements(reporter: Reporter, query: string) {
    return super.resolveElements(reporter, query);
  }

  __filepath(absolutePath: string) {
    return util.pathRelativeToBase(this.__target!.paths.output, absolutePath);
  }

  __path() {
    return this.__target ? `${this.__target.__path()}.exports` : `not implemented yet`;
  }

  __serialize() {
    return serialize(this);
  }
}

const notInjectableKeys = /(^__)|([^\\]=$)|tags|elements/;

export class BuildTargetElement extends Element {
  variant: string;
  environment: EnvironmentElement;
  targets: TargetExportsElement[];
  components: ComponentElement[];
  exports: ComponentElement[];
  type: string;
  __target: TargetElement;
  __outputdir: string;
  __root: RootGraph;

  static notInjectedKeys = new Set(["tags", "elements"]);

  constructor(reporter: Reporter, root: RootGraph, target: TargetElement, environment: EnvironmentElement, variant: string, outputdir: string) {
    super('build-target', target.name, target.__parent!); // the parent is the same as the target to have the same resolution behavior
    this.is = 'build-target';
    this.variant = variant;
    this.environment = environment;
    this.targets = [];
    this.components = [];
    this.exports = [];
    this.__target = target;
    this.__outputdir = outputdir;
    this.__root = root;
    this.__injectElements(reporter, [target]);
    this.__injectElements(reporter, [this.environment]);
    let at = new AttributePath(this);
    let components = new Set<ComponentElement>();
    this.__injectComponents(reporter, this, components);
    this.components = Array.from(components);
    this.__resolveTargets(reporter);
    this.type = AttributeTypes.validateString(reporter, at.set('.type'), this.type) || "bad type";
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

  __resolveTargets(reporter: Reporter) {
    let targets = validateTargetList(reporter, new AttributePath(this, '.targets'), this.targets || []);
    this.targets = [];
    targets.forEach(t => {
      if (t instanceof TargetExportsElement) {
        this.targets.push(t);
      }
      else {
        let exports = this.__resolveDelayedExports(reporter, t, this.environment);
        if (exports)
          this.targets.push(exports);
      }
    });
  }

  __path() {
    return `${super.__path()}{${this.variant}/${this.environment.name}}`;
  }

  __resolveDelayedExports(reporter: Reporter, target: TargetElement, environment: {name: string, compatibleEnvironments: string[]}) {
    let compatibleEnv = target.__compatibleEnvironment(reporter, environment);
    if (compatibleEnv) {
      let realTarget = this.__root.buildTarget(reporter, this, target, compatibleEnv, this.variant, this.__outputdir);
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
