import {
  Element, ProjectElement, DelayedElement,
  Reporter, AttributePath, DelayedQuery, Workspace} from '../index.priv';

export class MakeJSElement extends Element {
  __parent: MakeJSElement;
  __absoluteFilepath() : string {
    return this.__parent!.__absoluteFilepath();
  }
  __resolveValueInArray(reporter: Reporter, el, ret: any[], attrPath: AttributePath) {
    if (el instanceof DelayedElement && !el.__parent) {
      el.__parent = this;
      ret.push(el);
    }
    else super.__resolveValueInArray(reporter, el, ret, attrPath);
  }

  __resolveElementsGroup(reporter: Reporter, into: Element[], steps: string[], query: Element.Query, attrPath: AttributePath) {
    if (steps.length >= 5 && steps[0].length === 0 && steps[1].length === 0 && steps[2].length > 0) { // ^::.+
      let i = 3;
      while (i < steps.length && steps[i].length > 0)
        i++;
      if (i + 1 >= steps.length)
        attrPath.diagnostic(reporter, {
          type: "error",
          msg: "invalid external group syntax, missing closing '::'"
        });
      else {
        let gsteps = steps.slice(2, i);
        let gel: Element | undefined = undefined;
        if (gsteps.length === 1)
          gel = Workspace.globalRoot[`${gsteps[0]}=`];
        if (gel)
          gel.__resolveElementsGroupIn(reporter, into, query);
        else
          into.push(new DelayedQuery(gsteps, steps.slice(i + 1), query, this));
      }
    }
    else {
      super.__resolveElementsGroup(reporter, into, steps, query, attrPath);
    }
  }

  toJSON() {
    return serialize(this);
  }
}
export interface MakeJSElement {
  __root() : ProjectElement;
}

function serialize(element: any) {
  if (element instanceof Object) {
    let ret: any;
    if (element instanceof Set)
      element = [...element];
    if (Array.isArray(element)) {
      ret = element.map((e, idx) => serialize(e));
    }
    else {
      ret = {};
      for (let key of Object.getOwnPropertyNames(element)) {
        if (!Element.isReserved(key))
          ret[key] = serialize(element[key]);
      }
    }
    return ret;
  }
  return element;
}
