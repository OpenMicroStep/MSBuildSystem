import {Element, declareSimpleElementFactory, ComponentElement, Reporter, MakeJS, AttributeTypes, AttributePath} from '../index.priv';
import *  as path from 'path';

declareSimpleElementFactory('group', (reporter: Reporter, name: string, definition: MakeJS.Element, attrPath: AttributePath, parent: Element) => {
  return new GroupElement(name, parent);
});
export class GroupElement extends Element {
  elements: ComponentElement[];
  /** if defined, the absolute filepath */
  path?: string;
  constructor(name: string, parent: Element) {
    super('group', name, parent);
    this.elements = [];
    this.path = undefined;
  }

  __absoluteFilepath() : string {
    return this.path || this.__parent!.__absoluteFilepath();
  }

  __resolve(reporter: Reporter) {
    super.__resolve(reporter);
    var elements = <any[]>[];
    var type: string | undefined = undefined;
    var is: string | undefined = undefined;
    var loop = (el) => {
      var cis = el instanceof Element ? el.is : undefined;
      if (cis === 'group') {
        if (!(<GroupElement><any>el).__resolved)
          (<GroupElement><any>el).__resolve(reporter);
        var subs = (<GroupElement><any>el).elements;
        for (var j = 0, jlen = subs.length; j < jlen; ++j)
          loop(subs[j]);
        return;
      }
      if (type === undefined)
        type = typeof el;

      if (typeof el !== type) {
        reporter.diagnostic({
          type: 'error',
          path: `${this.__path()}.elements`,
          msg:  `elements must be of the same type, expecting ${type}, got ${typeof el}`
        });
      }
      else {
        if (is === undefined)
          is = cis;

        if (is !== cis) {
          reporter.diagnostic({
            type: 'error',
            path: `${this.__path()}.elements`,
            msg:  `elements must be of the same type, expecting ${is}, got ${cis}`
          });
        }
        else {
          elements.push(el);
        }
      }
    };
    for (var i = 0, len = this.elements.length; i < len; i++) {
      loop(this.elements[i]);
    }
    this.elements = elements;
  }

  __loadReservedValue(reporter: Reporter, key: string, value, attrPath: AttributePath) {
    if (key === 'elements') {
      this.elements = <ComponentElement[]>this.__loadElements(reporter, value, attrPath);
    }
    else if (key === 'path') {
      this.path = AttributeTypes.validateString(reporter, attrPath, value);
      if (this.path && !path.isAbsolute(this.path))
        this.path = path.join(this.__parent!.__absoluteFilepath(), this.path);
    }
    else {
      super.__loadReservedValue(reporter, key, value, attrPath);
    }
  }
}
