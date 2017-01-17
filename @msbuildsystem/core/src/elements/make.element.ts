import {
  Element, GroupElement, ProjectElement, DelayedElement,
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

  __resolveElementsGroup(reporter: Reporter, steps: string[], tagsQuery: string | undefined, ret: Element[]) {
    if (steps.length >= 5
     && steps[1].length === 0
     && steps[2].length > 0
     && ((steps[3].length === 0) || (steps.length >= 6 && steps[4].length === 0))
    ) { // ::[env:]target::
      if (Workspace.globalExports.has(steps[2]))
        ret.push(Workspace.globalExports.get(steps[2])!);
      else
        ret.push(new DelayedQuery(steps, tagsQuery, this));
      return true;
    }
    return super.__resolveElementsGroup(reporter, steps, tagsQuery, ret);
  }

  __resolveElementsTags(reporter: Reporter, el: Element, into: Element[], requiredTags: string[], rejectedTags: string[]) {
    let els = el.is === 'group' ? (<GroupElement>el).elements || [] : [el];
    for (el of els)
      if (this.__resolveElementsTagsFilter(el, requiredTags, rejectedTags))
        into.push(el);
  }


}
export interface MakeJSElement {
  __root() : ProjectElement;
}
