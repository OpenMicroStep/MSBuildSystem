import {
  Element, ProjectElement, DelayedElement,
  Reporter, PathReporter, DelayedQuery, Workspace} from '../index.priv';

export class MakeJSElement extends Element {
  __parent: MakeJSElement;
  __absoluteFilepath() : string {
    return this.__parent!.__absoluteFilepath();
  }
  __resolveValueInArray(at: PathReporter, el, ret: any[]) {
    if (el instanceof DelayedElement && !el.__parent) {
      el.__parent = this;
      ret.push(el);
    }
    else super.__resolveValueInArray(at, el, ret);
  }

  __resolveElementsGroup(at: PathReporter, into: Element[], steps: string[], query: Element.Query) {
    if (steps.length >= 5 && steps[0].length === 0 && steps[1].length === 0 && steps[2].length > 0) { // ^::.+
      let i = 3;
      while (i < steps.length && steps[i].length > 0)
        i++;
      if (i + 1 >= steps.length)
        at.diagnostic({
          is: "error",
          msg: "invalid external group syntax, missing closing '::'"
        });
      else {
        let gsteps = steps.slice(2, i);
        let gel: Element | undefined = undefined;
        if (gsteps.length === 1)
          gel = Workspace.globalRoot[`${gsteps[0]}=`];
        if (gel)
          gel.__resolveElementsGroupIn(at.reporter, into, query);
        else
          into.push(new DelayedQuery(gsteps, steps.slice(i + 1), query, this));
      }
    }
    else {
      super.__resolveElementsGroup(at, into, steps, query);
    }
  }
}
export interface MakeJSElement {
  __root() : ProjectElement;
}
