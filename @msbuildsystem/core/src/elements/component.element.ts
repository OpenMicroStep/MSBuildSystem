import {Element, declareSimpleElementFactory, Reporter, MakeJS, AttributeTypes, AttributePath} from '../index.priv';

declareSimpleElementFactory('component', (reporter: Reporter, name: string,
  definition: MakeJS.Element, attrPath: AttributePath, parent: Element
) => {
  return new ComponentElement('component', name, parent);
});
export class ComponentElement extends Element {
  static notInjectedKeys = new Set(["tags", "components", "elements"]);

  components: ComponentElement[];
  tags: string[];

  constructor(is: string, name: string, parent: Element) {
    super(is, name, parent);
    this.components = [];
    this.tags = [];
  }

  __injectElements(reporter: Reporter, elements: ComponentElement[]) {
    let keysWithSimpleValue = new Set<string>();
    for (let depcomponent of elements) {
      let keys = Object.keys(depcomponent);
      for (let key of keys) { if (ComponentElement.notInjectedKeys.has(key)) continue;
        let cvalue = this[key];
        let dvalue = depcomponent[key];
        let cvalueIsArr = cvalue && Array.isArray(cvalue);
        let dvalueIsArr = dvalue && Array.isArray(dvalue);
        if (cvalue !== undefined && cvalueIsArr !== dvalueIsArr) {
          reporter.diagnostic({
            type: "warning",
            msg: `attribute '${key}' value is incoherent for component ${this.__path()} `
               + `while injecting ${depcomponent.__path()}, attribute is ignored`,
            path: this.__path()
          });
        }
        else if (dvalueIsArr) {
          if (!cvalue)
            cvalue = this[key] = [];
          (<any[]>cvalue).unshift(...dvalue);
        }
        else if (keysWithSimpleValue.has(key)) {
          reporter.diagnostic({
            type: "warning",
            msg: `attribute '${key}' value is incoherent for component ${this.__path()} `
               + `while injecting ${depcomponent.__path()}, attribute is removed`,
            path: this.__path()
          });
          delete this[key];
        }
        else if (cvalue === undefined) {
          keysWithSimpleValue.add(key);
          this[key] = dvalue;
        }
      }
    }
  }

  __resolve(reporter: Reporter) {
    super.__resolve(reporter);
    this.components = this.__resolveElements<ComponentElement>(reporter, this.components, 'components', 'component');
    this.__injectElements(reporter, this.components);
    this.components = [];
  }

  __loadReservedValue(reporter: Reporter, key: string, value, attrPath: AttributePath) {
    if (key === 'components') {
      this.components = <ComponentElement[]>this.__loadElements(reporter, value, attrPath);
    }
    else if (key === 'tags') {
      this.tags = AttributeTypes.validateStringList(reporter, new AttributePath(this, '.', key), value);
    }
    else {
      super.__loadReservedValue(reporter, key, value, attrPath);
    }
  }
}
