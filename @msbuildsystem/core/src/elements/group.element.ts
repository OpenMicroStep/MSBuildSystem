import {Element, ElementLoadContext, Project, Reporter, MakeJS, AttributeTypes, AttributePath, MakeJSElement, util} from '../index.priv';

function createGroup(reporter: Reporter, name: string, definition: MakeJS.Element, attrPath: AttributePath, parent: MakeJSElement) {
  let group = new GroupElement('group', name, parent);
  if ("path" in definition) {
    let p = AttributeTypes.validateString.validate(reporter, attrPath, definition['path']);
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

  __loadReservedValue(context: ElementLoadContext, key: string, value, attrPath: AttributePath) {
    if (key !== 'path') // path is handled by the factory
      super.__loadReservedValue(context, key, value, attrPath);
  }
}
