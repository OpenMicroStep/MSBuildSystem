import {
  util, ComponentElement, Target, EnvironmentElement, Element, Reporter, AttributePath
} from '../index.priv';
import {injectElements, defaultKeyMap} from './injection';

export class TargetExportsElement extends ComponentElement {
  __target: Target;
  __generated: ComponentElement;
  type: string;

  constructor(target: Target, name: string) {
    super('component', name, null);
    this.__generated = new ComponentElement('component', 'generated', this);
    this.__target = target;
    this.__resolved = !!target;
    this.components.push(this.__generated);
  }

  __createGeneratedComponent(name: string) {
    let component = new ComponentElement('component', 'generated', this.__generated);
    this.__generated.components.push(component);
    return component;
  }

  __path() {
    return this.__target ? `${this.__target.__path()}.exports` : `not implemented yet`;
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
      at.push('[', '', ']');
      ret = element.map((e, idx) => serialize(reporter, at.set(idx, -2), target, e));
      at.pop(3);
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
