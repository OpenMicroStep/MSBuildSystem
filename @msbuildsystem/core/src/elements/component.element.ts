import {Element, MakeJSElement, Project, Reporter, MakeJS, AttributePath, AttributeTypes, serialize, DelayedInjection, GroupElement} from '../index.priv';

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

  __resolveElementsGroupPush(reporter: Reporter, into: Element[], query: Element.Query) {
    if (query.explicitAttributes || query.removedAttributes) {
      into.push(new DelayedInjection(query, this));
    }
    else {
      super.__resolveElementsGroupPush(reporter, into, query);
    }
  }
}
const validateComponents = AttributeTypes.listValidator(ComponentElement.validateAllowDelayed);
Element.registerAttributes(ComponentElement, [], {
  components: validateComponents,
  componentsByEnvironment: AttributeTypes.objectValidator({}, validateComponents)
});

export namespace ComponentElement {
  export const validateAndNormalizeAny: AttributeTypes.Validator0<any> = {
    validate: function validateAndNormalizeAny(reporter: Reporter, path: AttributePath, value: any) {
      return serialize(value);
    }
  };

  export function superValidateList<T, A0> (
    reporter: Reporter, path: AttributePath, attr: any[] | Set<any>, a0: A0,
    validator: AttributeTypes.Validator<T, A0>, push: (t: T) => void,
  ) {
    if (attr instanceof GroupElement) {
      path = new AttributePath(attr);
      attr = attr.elements as any[];
    }
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

  export function superValidateGroupList<T, T2 extends object, A0> (
    reporter: Reporter, at: AttributePath, attr: any[] | Set<any>, a0: A0,
    validateElement: AttributeTypes.Validator<T, A0>, validateGroup: AttributeTypes.ValidatorNU<Group<T, T2>, A0>,
    pushGroup: (t: Group<T, T2>) => void, pushValue: (t: T, idx: number) => void
  ) {
    if (attr instanceof Array || attr instanceof Set) {
      at.pushArray();
      let value;
      let idx = 0;
      for (value of attr) {
        at.setArrayKey(idx);
        if (value instanceof GroupElement) {
          value = validateGroup.validate(reporter, at, value, a0);
          if (value !== undefined)
            pushGroup(value);
        }
        else {
          value = validateElement.validate(reporter, at, value, a0);
          if (value !== undefined)
            pushValue(value, idx);
        }
        idx++;
      }
      at.popArray();
    }
    else {
      at.diagnostic(reporter, { type: "warning", msg: `attribute must be an array`});
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
    return objectValidatorImpl((obj, a0) => obj instanceof Element ? !!obj.__keyMeaning(a0) : false, extensions, objectForKeyValidator);
  }

  export type Group<T, T2 extends object> = { elements: T[] } & T2; // TODO: remove this
  export function groupValidator<T, T2 extends object, K, A0>(validator: AttributeTypes.ValidatorT<T, A0>, extensions: AttributeTypes.Extensions<T2, A0>, objectForKeyValidator?: AttributeTypes.Validator<K, string>) : AttributeTypes.ValidatorTNU<Group<T, T2 & { [s: string]: K }>[], A0> {
    const validateGroup = objectValidator<Group<T, T2>, K, A0>({ elements: setAsListValidator(validator), ...extensions as any }, objectForKeyValidator);
    const validateGroupDefaults = objectValidator<Group<T, T2>, K, A0>({ elements: AttributeTypes.validateAny, ...extensions as any }, objectForKeyValidator);
    function validateGroups(reporter: Reporter, path: AttributePath, attr, a0: A0) {
      let ret: Group<T, T2 & { [s: string]: K }>[] = [];
      let idxs: number[] = [];
      let elements: T[] = [];
      superValidateGroupList(reporter, path, attr, a0, validator, validateGroup, g => ret.push(g), (v, idx) => {
        elements.push(v);
        idxs.push(idx);
      });
      if (elements.length) {
        path.push('[]');
        let g = validateGroupDefaults.validate(reporter, path, { elements: elements }, a0);
        if (g)
          ret.push(g);
        path.pop();
      }
      return ret;
    };
    return { validate: validateGroups, traverse(lvl, ctx) {
      return validator.traverse(lvl + 1, ctx);
    }};
  }

}
