import {declareElementFactory, elementValidator, validateElement,
  Element, DelayedElement, ComponentElement, EnvironmentElement, GroupElement,
  Reporter, MakeJS, AttributeTypes, AttributePath, RootGraph
} from '../index.priv';

const componentValidator = (reporter: Reporter, path: AttributePath, value: any) =>  {
  return (
    value instanceof Element && (value.is === "component" || value.is === "group")
    ? <ComponentElement | GroupElement>value
    : undefined
  );
};
const validateComponentList = AttributeTypes.listValidator<ComponentElement | GroupElement, any>(componentValidator);
const validateComponentByEnv = AttributeTypes.byEnvListValidator<ComponentElement | GroupElement, any>(componentValidator);


function __resolveValuesByEnvForEnv(
  reporter: Reporter, element: Element,
  environment: EnvironmentElement, valuesByEnv: {[s: string]: any[]}, values: any[]
) {
  for (var env in valuesByEnv) {
    var envs = element.resolveElements(reporter, env);
    if (envs.indexOf(environment) !== -1) {
      var v = valuesByEnv[env];
      if (Array.isArray(values) && Array.isArray(v))
        values.push(...valuesByEnv[env]);
    }
  }
}

declareElementFactory('target', (reporter: Reporter, name: string, definition: MakeJS.Target, attrPath: AttributePath, parent: Element) => {
  let target = new TargetElement(name, parent);
  parent.__project().targets.push(target);
  return [target];
});
export class TargetElement extends ComponentElement {
  environments: EnvironmentElement[];
  type: string;
  exports: (ComponentElement | GroupElement)[];
  exportsByEnvironment: { [s: string]: (ComponentElement | GroupElement)[] };

  constructor(name: string, parent: Element) {
    super('target', name, parent);
    this.environments = [];
  }

  __loadReservedValue(reporter: Reporter, key: string, value, attrPath: AttributePath) {
    if (key === 'environments') {
      this.environments = <EnvironmentElement[]>this.__loadElements(reporter, value, attrPath);
    }
    else {
      super.__loadReservedValue(reporter, key, value, attrPath);
    }
  }

  __resolveExports(reporter: Reporter, environment: EnvironmentElement) {
    let exports = <(ComponentElement | GroupElement)[]>[];
    exports.push(...this.exports);
    __resolveValuesByEnvForEnv(reporter, this, environment, this.exportsByEnvironment, exports);
    return new TargetExportElement(this, exports);
  }

  __resolveValueForKey(reporter: Reporter, v, k: string, keepGroups: boolean, attrPath: AttributePath) {
    super.__resolveValueForKey(reporter, v, k, k === 'exports' || k === 'exportsByEnvironment', attrPath);
  }

  __resolve(reporter: Reporter) {
    super.__resolve(reporter);
    this.environments = this.__resolveElements<EnvironmentElement>(reporter, this.environments, 'environments', 'environment');
    if (this.environments.length === 0)
      reporter.diagnostic({
        type: "warning",
        msg: `attribute "environments" of target '${this.name}' is empty, target can't be build`,
        path: `${this.__path()}.environments`
      });
    let at = new AttributePath(this.__path());
    at.push('');
    this.type = AttributeTypes.validateString(reporter, at.set('.type'), this.type) || "bad type";
    this.exports = validateComponentList(reporter, at.set('.exports'), this.exports  || [], null);
    this.exportsByEnvironment = validateComponentByEnv(reporter, at.set('.exportsByEnvironment'), this.exports  || {}, null);
    at.pop();
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
const validateTargetList = AttributeTypes.listValidator<TargetElement, any>(function (reporter: Reporter, path: AttributePath, value: any) {
  value = validateElement(reporter, path, value);
  if (value !== undefined && value instanceof TargetElement)
    return <TargetElement>value;
  if (value !== undefined)
    path.diagnostic(reporter, { type: "warning", msg: `attribute must be a 'target' element, got a ${value.is}`});
  return undefined;
});

export class TargetExportElement extends TargetElement {
  constructor(target: TargetElement, exports: (ComponentElement| GroupElement)[]) {
    super(target.name, target);
    for (let element of exports) {
      this[element.name + "="] = element;
    }
  }
}

export class BuildTargetElement extends TargetElement {
  variant: string;
  environment: EnvironmentElement;
  targets: BuildTargetElement[];
  __target: TargetElement;
  root: RootGraph;
  constructor(reporter: Reporter, root: RootGraph, target: TargetElement, environment: EnvironmentElement, variant: string) {
    super(target.name, target.__parent!);
    this.root = root; // this is a required to use delayed resolve target creation
    for (let k in target) {
      this[k] = target[k];
    }
    this.is = 'build-target';
    this.variant = variant;
    this.environment = environment;
    this.__target = target;

    // resolve delayed/environment related elements
    // 1. inject environment attributes
    this.__injectElements(reporter, [environment]);
    // 2. resolve delayed elements
    this.__resolve(reporter);
    // 3. resolve environment related attributes
    this.__resolveByEnvironment(reporter, this, this.environment);
  }

  __path() {
    return `${super.__path()}{${this.variant}/${this.environment.name}}`;
  }

  __resolveTargets(reporter: Reporter) {
    let at = new AttributePath(this.__path());
    at.push('');
    let targets = validateTargetList(reporter, at.set('targets'), this.targets || [], null);
    this.targets = [];
    targets.forEach(t => {
      if (t instanceof BuildTargetElement)
        this.targets.push(t);
      else {
        let compatibleEnv = t.__compatibleEnvironment(reporter, this.environment);
        if (compatibleEnv)
          this.targets.push(this.buildTargetElement(reporter, t, compatibleEnv));
      }
    });
    at.pop();
  }

  __resolveByEnvironment(reporter: Reporter, element: Element, environment: EnvironmentElement) {
    for (let k in element) {
      let valuesByEnv;
      if (k.endsWith("ByEnvironment") && typeof (valuesByEnv = element[k]) === 'object') {
        let attr = k.substring(0, k.length - "ByEnvironment".length);
        let arr = attr in element ? element[attr] : (element[attr] = []);
        __resolveValuesByEnvForEnv(reporter, element, environment, valuesByEnv, arr);
        delete element[k];
      }
    }
  }

  resolveElementsForEnvironment(reporter: Reporter, elements: Element[], environment: EnvironmentElement) {
    elements.forEach(el => this.__resolveByEnvironment(reporter, el, environment));
  }

  buildTargetElement(reporter: Reporter, target: TargetElement, environment: EnvironmentElement) : BuildTargetElement {
    return this.root.buildTargetElement(reporter, target, environment, this.variant);
  }

  __resolveValue(reporter: Reporter, el, ret: any[], keepGroups: boolean, attrPath: AttributePath) {
    if (el instanceof DelayedElement) {
      ret.push(...el.__delayedResolve(reporter, this, attrPath));
    }
    else {
      super.__resolveValue(reporter, el, ret, keepGroups, attrPath);
    }
  }
}