import {Element, MakeJSElement, Project, Reporter, MakeJS, AttributePath, AttributeTypes, InjectionContext} from '../index.priv';

function createComponent(reporter: Reporter, name: string,
  definition: MakeJS.Element, attrPath: AttributePath, parent: Element
) {
  return new ComponentElement('component', name, parent);
}
Project.elementFactories.registerSimple('component', createComponent);
Project.elementExportsFactories.registerSimple('component', createComponent);
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
const validateComponents = AttributeTypes.listValidator(ComponentElement.validateAllowDelayed);
Element.registerAttributes(ComponentElement, [], {
  components: validateComponents,
  componentsByEnvironment: AttributeTypes.objectValidator({}, validateComponents)
});

export namespace ComponentElement {
  export function superValidateList<T, A0> (
    reporter: Reporter, path: AttributePath, attr: T[] | Set<T>, a0: A0,
    validator: AttributeTypes.Validator<T, A0>, push: (t: T) => void
  ) {
    if (attr instanceof Array || attr instanceof Set) {
      path.pushArray();
      let value: T | undefined;
      let idx = 0;
      for (value of attr) {
        value = validator.validate(reporter, path.setArrayKey(idx++), value, a0);
        if (value !== undefined)
          push(value);
      }
      path.popArray();
    }
    else {
      path.diagnostic(reporter, { type: "warning", msg: `attribute must be an array`});
    }
  }

  export function setValidator<T    >(validator: AttributeTypes.ValidatorT0<T    >) : AttributeTypes.ValidatorTNU0<Set<T>    >;
  export function setValidator<T, A0>(validator: AttributeTypes.ValidatorT <T, A0>) : AttributeTypes.ValidatorTNU <Set<T>, A0>;
  export function setValidator<T, A0>(validator: AttributeTypes.ValidatorT <T, A0>) {
    function validateSet(reporter: Reporter, path: AttributePath, attr, a0: A0) {
      let ret = new Set<T>();
      superValidateList(reporter, path, attr, a0, validator, ret.add.bind(ret));
      return ret;
    };
    return { validate: validateSet, traverse: (lvl, ctx) => `set of ${validator.traverse(lvl + 1, ctx)}` };
  }

  export function setAsListValidator<T    >(validator: AttributeTypes.ValidatorT0<T    >) : AttributeTypes.ValidatorTNU0<T[]    >;
  export function setAsListValidator<T, A0>(validator: AttributeTypes.ValidatorT <T, A0>) : AttributeTypes.ValidatorTNU <T[], A0>;
  export function setAsListValidator<T, A0>(validator: AttributeTypes.ValidatorT <T, A0>) {
    function validateSet(reporter: Reporter, path: AttributePath, attr, a0: A0) {
      let ret = new Set<T>();
      superValidateList(reporter, path, attr, a0, validator, ret.add.bind(ret));
      return [...ret];
    };
    return { validate: validateSet, traverse: (lvl, ctx) => `set of ${validator.traverse(lvl + 1, ctx)}` };
  }

  function objectValidatorImpl<T, K, A0>(isReserved: (obj, key: string) => boolean, extensions: AttributeTypes.Extensions<T, A0>, objectForKeyValidator?: AttributeTypes.Validator<K, string>) {
    function validateObject(reporter: Reporter, path: AttributePath, attr, a0: A0) : T & { [s: string]: K } {
      var ret = <T & { [s: string]: K }>{};
      AttributeTypes.superValidateObject(reporter, path, attr, a0, ret, extensions, { validate(reporter: Reporter, at: AttributePath, value: any, key: string) : K | undefined {
        if (isReserved(attr, key)) return undefined;
        else if (objectForKeyValidator) return objectForKeyValidator.validate(reporter, at, value, key);
        else {
          path.diagnostic(reporter, { type: "warning", msg: `attribute is unused` });
          return undefined;
        }
      }});
      return ret;
    };
    return { validate: validateObject, traverse: (lvl, ctx) => `object with` };
  }

  export function objectValidator<T>(extensions: AttributeTypes.Extensions0<T>) : AttributeTypes.ValidatorTNU0<T>;
  export function objectValidator<T, A0>(extensions: AttributeTypes.Extensions<T, A0>) : AttributeTypes.ValidatorTNU<T, A0>;
  export function objectValidator<T, K>(extensions: AttributeTypes.Extensions0<T>, objectForKeyValidator?: AttributeTypes.Validator<K, string>) : AttributeTypes.ValidatorTNU0<T & { [s: string]: K }>;
  export function objectValidator<T, K, A0>(extensions: AttributeTypes.Extensions<T, A0>, objectForKeyValidator?: AttributeTypes.Validator<K, string>) : AttributeTypes.ValidatorTNU<T & { [s: string]: K }, A0>;
  export function objectValidator<T, K, A0>(extensions: AttributeTypes.Extensions<T, A0>, objectForKeyValidator?: AttributeTypes.Validator<K, string>) {
    return objectValidatorImpl((obj, a0) => obj instanceof Element ? obj.__keyMeaning(a0) !== Element.KeyMeaning.User : false, extensions, objectForKeyValidator);
  }

  export type Group<T, T2 extends object> = {values: T[], ext: T2}; // TODO: remove this
  export function groupValidator<T, T2 extends object, K, A0>(validator: AttributeTypes.ValidatorT<T, A0>, extensions: AttributeTypes.Extensions<T2, A0>, objectForKeyValidator?: AttributeTypes.Validator<K, string>) : AttributeTypes.ValidatorTNU<Group<T, T2 & { [s: string]: K }>[], A0> {
    const validateObject = objectValidator<T2, K, A0>(extensions, objectForKeyValidator);
    function validateGroups(reporter: Reporter, path: AttributePath, attr, a0: A0) {
      let ret: Group<T, T2 & { [s: string]: K }>[] = [];
      superValidateList(reporter, path, attr, a0, { validate(reporter: Reporter, at: AttributePath, value, a0: A0) {
        let values = [] as T[];
        let ext: T2 & { [s: string]: K };
        ext = validateObject.validate(reporter, at, value, a0);
        return { values: values, ext: ext };
      }}, ret.push.bind(ret));
      return ret;
    };
    return { validate: validateGroups, traverse(lvl, ctx) {
      return validator.traverse(lvl + 1, ctx);
    }};
  }

}
