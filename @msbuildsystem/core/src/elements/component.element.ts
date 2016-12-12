import {Element, MakeJSElement, declareSimpleElementFactory, Reporter, MakeJS, AttributePath} from '../index.priv';

declareSimpleElementFactory('component', (reporter: Reporter, name: string,
  definition: MakeJS.Element, attrPath: AttributePath, parent: Element
) => {
  return new ComponentElement('component', name, parent);
});
export class ComponentElement extends MakeJSElement {

  components: ComponentElement[];
  componentsByEnvironment: { [s: string]: ComponentElement [] };

  constructor(is: string, name: string, parent: Element | null) {
    super(is, name, parent);
    this.components = [];
    this.componentsByEnvironment = {};
    this.tags = [];
  }

  __loadReservedValue(reporter: Reporter, key: string, value, attrPath: AttributePath) {
    if (key === 'components') {
      this.__loadIfArray(reporter, value, this.components, attrPath);
    }
    else if (key === 'componentsByEnvironment') {
      this.__loadIfObject(reporter, value, this.componentsByEnvironment, attrPath);
    }
    else {
      super.__loadReservedValue(reporter, key, value, attrPath);
    }
  }
}
