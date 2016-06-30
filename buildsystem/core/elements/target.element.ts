import {Element, DelayedElement, declareElementFactory, elementValidator} from '../element';
import {ComponentElement} from './component.element';
import {Reporter} from '../runner';
import * as MakeJS from '../make';
import {AttributeTypes, Attributes, AttributePath, AttributeResolvers} from '../attributes';
import {EnvironmentElement} from './environment.element';
import {GroupElement} from './group.element';
import {RootGraph} from '../project';

const componentValidator = (reporter: Reporter, path: AttributePath, value: any) =>  {
  return (
    value instanceof Element && (value.is === "component" || value.is === "group") 
    ? <ComponentElement | GroupElement>value 
    : undefined
  );
};
const componentListResolver = new AttributeResolvers.ListResolver(componentValidator);
const componentByEnvResolver = new AttributeResolvers.ByEnvListResolver(componentValidator);

export const targetElementValidator = (reporter: Reporter, path: AttributePath, value: any) => {
  if ((value = elementValidator(reporter, path, value)) !== undefined && value instanceof TargetElement)
    return <TargetElement>value;
  if (value !== undefined)
    reporter.diagnostic({ type: "warning", msg: `attribute ${path.toString()} must be a 'target' element, got a ${value.is}`});
  return undefined;
};
const targetListResolver = new AttributeResolvers.ListResolver(targetElementValidator);

declareElementFactory('target', (reporter: Reporter, name: string, definition: MakeJS.Target, attrPath: AttributePath, parent: Element) => {
  let target = new TargetElement(name, parent);
  parent.__project().targets.push(target);
  return [target];
});
export class TargetElement extends ComponentElement {
  environments: EnvironmentElement[];
  type: string;
  exports: (ComponentElement | GroupElement)[];
  exportsByEnvironment: { [s:string] : (ComponentElement | GroupElement)[] };

  constructor(name: string, parent: Element) {
    super('target', name, parent);
    this.environments = [];
  }

  __loadReservedValue(reporter: Reporter, key: string, value, attrPath: AttributePath)
  {
    if (key === 'environments') {
      this.environments = <EnvironmentElement[]>this.__loadElements(reporter, value, attrPath);
    }
    else {
      super.__loadReservedValue(reporter, key, value, attrPath);
    }
  }

  __resolveValuesByEnvForEnv(reporter: Reporter, environment: EnvironmentElement, valuesByEnv: {[s:string] : any[]}, values: any[])
  {
    for (var env in valuesByEnv) {
      var envs = this.resolveElements(reporter, env);
      if (envs.indexOf(environment) !== -1) {
        var v = valuesByEnv[env];
        if (Array.isArray(values) && Array.isArray(v))
          values.push(...valuesByEnv[env]);
      }
    }
  }

  __resolveExports(reporter: Reporter, environment: EnvironmentElement)
  {
    let exports = <(ComponentElement | GroupElement)[]>[];
    exports.push(...this.exports);
    this.__resolveValuesByEnvForEnv(reporter, environment, this.exportsByEnvironment, exports);
    return new TargetExportElement(this, exports);  
  }

  __resolveValueForKey(reporter: Reporter, v, k: string, keepGroups) {
    super.__resolveValueForKey(reporter, v, k, k === 'exports' || k === 'exportsByEnvironment');
  }

  __resolve(reporter: Reporter) {
    super.__resolve(reporter);
    this.environments = this.__resolveElements(reporter, this.environments, 'environments', 'environment');
    if (this.environments.length === 0)
      reporter.diagnostic({ type: "warning", msg: `target ${this.name} attribute "environments" is empty, target can't be build`});
    let at = new AttributePath(this.__path());
    at.push('');
    this.type = AttributeTypes.validateString(reporter, at.set('type'), this.type);
    this.exports = componentListResolver.resolve(reporter, this.exports || [], at.set('exports'));
    this.exportsByEnvironment = componentByEnvResolver.resolve(reporter, this.exports || {}, at.set('exportsByEnvironment'));
    at.pop();
  }

  __compatibleEnvironment(reporter: Reporter, environment: EnvironmentElement) : EnvironmentElement {
    let compatibleEnvs = this.environments.filter(e => 
      e.name === environment.name || 
      environment.compatibleEnvironments.indexOf(e.name) !== -1
    );
    if (compatibleEnvs.length === 0) {
      reporter.diagnostic({ type: "error", msg: `no compatible environment found for target '${this.name}' with build environment '${environment.name}'`});
    }
    else if (compatibleEnvs.length > 1) {
      reporter.diagnostic({ type: "error", msg: `multiple compatible environments found for target '${this.name}' with build environment '${environment.name}'`});
    }
    else return compatibleEnvs[0];
    return null;
  }
}

export class TargetExportElement extends TargetElement
{
  constructor(target: TargetElement, exports: (ComponentElement| GroupElement)[])
  {
    super(target.name, null);
    for(let element of exports) {
      this[element.name + "="] = element;
    }
  }
}

export class BuildTargetElement extends TargetElement {
  variant: string;
  environment: EnvironmentElement;
  targets: BuildTargetElement[];
  __target: TargetElement;
  constructor(reporter: Reporter, root: RootGraph, target: TargetElement, environment: EnvironmentElement, variant: string) {
    super(target.name, target.__parent);
    for (var k in target) {
      this[k] = target[k];
    }
    this.is = 'build-target';
    this.variant = variant;
    this.environment = environment;
    this.__target = target;
    this.__injectElements(reporter, [environment]);
    this.__resolve(reporter); // resolve delayed elements
    for (var k in this) {
      if (k.endsWith("ByEnvironment") && typeof k === 'object') {
        var valuesByEnv = this[k];
        var attr = k.substring(0, k.length - "ByEnvironment".length);
        var arr = attr in this ? this[attr] : (this[attr] = []);
        this.__resolveValuesByEnvForEnv(reporter, this.environment, valuesByEnv, arr);
      }
    }
    let at = new AttributePath(this.__path());
    at.push('');
    let targets = targetListResolver.resolve(reporter, this.targets|| [], at.set('targets'));
    this.targets = [];
    targets.forEach(t => {
      let compatibleEnv = t.__compatibleEnvironment(reporter, this.environment);
      if (compatibleEnv)
        this.targets.push(root.buildTargetElement(reporter, t, compatibleEnv, variant));
    });
    at.pop();
  }

  __resolveValue(reporter: Reporter, el, ret: any[])
  {
    if (el instanceof DelayedElement) {
      ret.push(...el.__delayedResolve(reporter, this));
    }
    else {
      super.__resolveValue(reporter, el, ret);
    }
  }
}
