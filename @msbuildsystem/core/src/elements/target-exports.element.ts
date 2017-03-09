import {
  util, ComponentElement, Target
} from '../index.priv';

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
    super('component', name, null);
    this.__target = target;
    this.__resolved = !!target;
  }

  __filepath(absolutePath: string) {
    return util.pathRelativeToBase(this.__target!.paths.output, absolutePath);
  }

  __path() {
    return this.__target ? `${this.__target.__path()}.exports` : `not implemented yet`;
  }
}
