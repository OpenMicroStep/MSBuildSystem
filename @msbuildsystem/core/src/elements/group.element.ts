import {Element, ElementLoadContext, Project, ComponentElement, Reporter, MakeJS, AttributeTypes, AttributePath, MakeJSElement, util} from '../index.priv';
import *  as path from 'path';

Project.elementFactories.registerSimple('group', (reporter: Reporter, name: string, definition: MakeJS.Element, attrPath: AttributePath, parent: MakeJSElement) => {
  let group = new GroupElement('group', name, parent);
  if ("path" in definition) {
    let p = AttributeTypes.validateString(reporter, attrPath, definition['path']);
    p = p && util.pathJoinIfRelative(parent.__absoluteFilepath(), p);
    group.path = p;
  }
  return group;
});
export class GroupElement extends MakeJSElement {
  elements: ComponentElement[] = [];
  /** if defined, the absolute filepath */
  path: string | undefined = undefined;

  __absoluteFilepath() : string {
    return this.path || this.__parent!.__absoluteFilepath();
  }

  __resolveWithPath(reporter: Reporter, attrPath: AttributePath) {
    super.__resolveWithPath(reporter, attrPath);
    var elements = <any[]>[];
    var type: string | undefined = undefined;
    var is: string | undefined = undefined;
    var loop = (el) => {
      var cis = el instanceof Element ? el.is : "not an element";
      if (cis === 'group') {
        (el as GroupElement).__resolve(reporter);
        var subs = (el as GroupElement).elements;
        attrPath.push('.elements[', '', ']');
        for (var j = 0, jlen = subs.length; j < jlen; ++j) {
          attrPath.set(j, -2);
          loop(subs[j]);
        }
        attrPath.pop(3);
        return;
      }
      if (type === undefined)
        type = typeof el;

      if (typeof el !== type) {
        attrPath.diagnostic(reporter, {
          type: 'error',
          msg:  `elements must be of the same type, expecting ${type}, got ${typeof el}`
        });
      }
      else {
        if (is === undefined)
          is = cis;

        if (is !== cis) {
          attrPath.diagnostic(reporter, {
            type: 'error',
            msg:  `elements must be of the same type, expecting ${is}, got ${cis}`
          });
        }
        else {
          elements.push(el);
        }
      }
    };
    attrPath.push('.elements[', '', ']');
    for (var i = 0, len = this.elements.length; i < len; i++) {
      attrPath.set(i, -2);
      loop(this.elements[i]);
    }
    attrPath.pop(3);
    this.elements = elements;
  }

  __loadReservedValue(context: ElementLoadContext, key: string, value, attrPath: AttributePath) {
    if (key !== 'path') // path is handled by the factory
      super.__loadReservedValue(context, key, value, attrPath);
  }
}
