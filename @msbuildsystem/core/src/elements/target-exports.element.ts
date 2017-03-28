import {
  ComponentElement, Target, Element, Reporter, AttributePath, AttributeTypes, MakeJS, Project
} from '../index.priv';
import {injectElements} from './injection';

function createExportsComponent(reporter: Reporter, name: string,
  definition: MakeJS.Element, attrPath: AttributePath, parent: Element
) {
  let env = AttributeTypes.validateString(reporter, attrPath, definition.environment);
  let variant = AttributeTypes.validateString(reporter, attrPath, definition.variant);
  return env && variant ? new TargetExportsElement('component', name, env, variant) : undefined;
}
Project.elementExportsFactories.registerSimple('target-exports', createExportsComponent);
export class TargetExportsElement extends ComponentElement {
  __target: Target | null;
  __generated: ComponentElement;
  environment: string;
  variant: string;

  constructor(is: string, name: string, environment: string, variant: string) {
    super(is, name, null);
    this.environment = environment;
    this.variant = variant;
  }

  __path() {
    return `${this.name}{${this.variant}/${this.environment}}.exports`;
  }
}

export class BuildTargetExportsElement extends TargetExportsElement {
  __target: Target;
  __generated: ComponentElement;

  constructor(target: Target, name: string) {
    super('target-exports', name, target.environment, target.variant);
    this.__generated = new ComponentElement('component', 'generated', this);
    this.__target = target;
    this.__resolved = !!target;
    this.components.push(this.__generated);
  }

  __resolve(reporter: Reporter) {
    throw new Error(`__resolve is disabled for BuildTargetExportsElement`);
  }

  __createGeneratedComponent(name: string) {
    let component = new ComponentElement('component', name, this.__generated);
    this.__generated.components.push(component);
    return component;
  }

  __serialize(reporter: Reporter) {
    return serialize(reporter, new AttributePath(this), this.__target, this);
  }
}

function keyMap(key: string) {
  if (key === 'environments')
    return 'components';
  return Element.isReserved(key) ? '' : key;
}

function serialize(reporter: Reporter, at: AttributePath, target: Target, element: any) {
  if (typeof element === "object") {
    let ret: any;
    if (Array.isArray(element)) {
      at.pushArray();
      ret = element.map((e, idx) => serialize(reporter, at.setArrayKey(idx), target, e));
      at.popArray();
    }
    else if (element instanceof Element) {
      injectElements(reporter, [element], ret = {}, at, target.attributes, keyMap, (at, key, value) => {
        if (key === 'is' && value === 'environment')
          return 'component';
        if (key === 'environments' && Array.isArray(value)) // will be saved to components
          value = value.filter(env => env === target.attributes.environment);
        return serialize(reporter, at, target, value);
      });
    }
    else {
      ret = {};
      at.push('.', '');
      for (let k in element)
        ret[k] = serialize(reporter, at.set(k), target, element[k]);
      at.pop(2);
    }
    return ret;
  }
  return element;
}
