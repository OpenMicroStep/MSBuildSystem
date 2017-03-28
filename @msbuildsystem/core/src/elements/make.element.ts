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

  __resolveElementsGroup(reporter: Reporter, into: Element[], steps: string[], tags: Element.Tags, attrPath: AttributePath) {
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
          gel = Workspace.globalExports.get(gsteps[0]);
        if (gel && gel.__passTags(tags))
          into.push(gel);
        else if (!gel)
          into.push(new DelayedQuery(gsteps, steps.slice(i + 1), tags, this));
      }
    }
    else {
      super.__resolveElementsGroup(reporter, into, steps, tags, attrPath);
    }
  }
}
export interface MakeJSElement {
  __root() : ProjectElement;
}
