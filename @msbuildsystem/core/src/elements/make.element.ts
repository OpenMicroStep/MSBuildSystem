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
    if (steps.length >= 5
     && steps[1].length === 0
     && steps[2].length > 0
     && ((steps[3].length === 0) || (steps.length >= 6 && steps[4].length === 0))
    ) { // ::[env:]target::
      let gel = Workspace.globalExports.get(steps[2]);
      if (gel && gel.__passTags(tags))
        into.push(gel);
      else if (!gel)
        into.push(new DelayedQuery(steps, tags, this));
    }
    else {
      super.__resolveElementsGroup(reporter, into, steps, tags, attrPath);
    }
  }
}
export interface MakeJSElement {
  __root() : ProjectElement;
}
