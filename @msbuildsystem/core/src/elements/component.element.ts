import {Element, MakeJSElement, Project, Reporter, MakeJS, AttributePath} from '../index.priv';

Project.elementFactories.registerSimple('component', (reporter: Reporter, name: string,
  definition: MakeJS.Element, attrPath: AttributePath, parent: Element
) => {
  return new ComponentElement('component', name, parent);
});
export class ComponentElement extends MakeJSElement {
  static validate = Element.elementValidator('component', ComponentElement);
  static validateAllowDelayed = Element.elementIsValidator(['component', 'delayed']);

  components: ComponentElement[];
  componentsByEnvironment: { [s: string]: ComponentElement[] };

  constructor(is: string, name: string, parent: Element | null) {
    super(is, name, parent);
    this.components = [];
    this.componentsByEnvironment = {};
  }
}
