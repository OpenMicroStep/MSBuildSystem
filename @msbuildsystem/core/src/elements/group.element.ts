import {Element, ElementLoadContext, Project, Reporter, MakeJS, AttributeTypes, PathReporter, MakeJSElement, util} from '../index.priv';

function createGroup(at: PathReporter, name: string, definition: MakeJS.Element, parent: MakeJSElement) {
  let group = new GroupElement('group', name, parent);
  if ("path" in definition) {
    let p = AttributeTypes.validateString.validate(at, definition['path']);
    p = p && util.pathJoinIfRelative(parent.__absoluteFilepath(), p);
    group.path = p;
  }
  return group;
}
Project.elementFactories.registerSimple('group', createGroup);
Project.elementExportsFactories.registerSimple('group', createGroup);
export const _GroupElement = Element.DynGroupElement(MakeJSElement); // see https://github.com/Microsoft/TypeScript/issues/14075
export class GroupElement extends _GroupElement {
  /** if defined, the absolute filepath */
  path: string | undefined = undefined;

  __absoluteFilepath() : string {
    return this.path || this.__parent!.__absoluteFilepath();
  }
}
Element.registerAttributes(GroupElement, ['path'], {});
