import {Element, ProjectElement, Reporter, AttributePath, DelayedElement, DelayedQuery, Workspace} from '../index.priv';

export class MakeJSElement extends Element {
  __parent: MakeJSElement;
  __absoluteFilepath() : string {
    return this.__parent!.__absoluteFilepath();
  }
  __resolveValueInArray(reporter: Reporter, el, ret: any[], keepGroups: boolean, attrPath: AttributePath) {
    if (el instanceof DelayedElement && !el.__parent) {
      el.__parent = this;
      ret.push(el);
    }
    else super.__resolveValueInArray(reporter, el, ret, keepGroups, attrPath);
  }

  __resolveElementsSteps(reporter: Reporter, steps: string[], groups: string[], ret: Element[]) : boolean {
    if (steps.length >= 5
     && steps[1].length === 0
     && steps[2].length > 0
     && ((steps[3].length === 0) || (steps.length >= 6 && steps[4].length === 0))
    ) { // ::[env:]target::
      if (Workspace.globalExports.has(steps[2]))
        ret.push(Workspace.globalExports.get(steps[2])!);
      else
        ret.push(new DelayedQuery(steps, groups.join('+'), this));
      return true;
    }
    return super.__resolveElementsSteps(reporter, steps, groups, ret);
  }
}
export interface MakeJSElement {
  __root() : ProjectElement;
}
