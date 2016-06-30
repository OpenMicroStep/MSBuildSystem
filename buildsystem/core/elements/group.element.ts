import {Element, declareElementFactory} from '../element';
import {ComponentElement} from './component.element';
import {Reporter} from '../runner';
import * as MakeJS from '../make';
import {AttributeTypes, AttributePath} from '../attributes';

declareElementFactory('group', (reporter: Reporter, name: string, definition: MakeJS.Element, attrPath: AttributePath, parent: Element) => {
  return [new GroupElement(name, parent)];
});
export class GroupElement extends Element {
  elements: ComponentElement[];
  path: string;
  constructor(name: string, parent: Element) {
    super('group', name, parent);
    this.elements = [];
    this.path = null;
  }

  __resolve(reporter: Reporter) {
    super.__resolve(reporter);
    var elements = [];
    var type = undefined;
    var is = undefined;
    var loop = (el) => {
      var cis = el instanceof Element ? el.is : null;
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
        reporter.diagnostic({ type: 'error', msg:  `'${this.__path()}.elements' must only contains elements of the same type, expecting ${type}, got ${typeof el}`});
      }
      else {
        if (is === undefined)
          is = cis;

        if (is !== cis) {
          reporter.diagnostic({ type: 'error', msg:  `'${this.__path()}.elements' must only contains elements of the same type, expecting ${is}, got ${cis}`});
        }
        else {
          elements.push(el);
        }
      }
    }
    for (var i = 0, len = this.elements.length; i < len; i++) {
      loop(this.elements[i]);
    }
    this.elements = elements;
  }

  __loadReservedValue(reporter: Reporter, key: string, value, attrPath: AttributePath)
  {
    if (key === 'elements') {
      this.elements = <ComponentElement[]>this.__loadElements(reporter, value, attrPath);
    }
    else if (key === 'path') {
      this.path = AttributeTypes.validateString(reporter, attrPath, value);
    }
    else {
      super.__loadReservedValue(reporter, key, value, attrPath);
    }
  }
}
