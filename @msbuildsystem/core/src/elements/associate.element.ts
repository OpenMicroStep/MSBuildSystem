import {Element, Project, Reporter, MakeJS, AttributePath, ComponentElement, AttributeTypes, Target, injectComponentsOf, injectElements} from '../index.priv';
import Validator = AttributeTypes.Validator;
import Extensions = AttributeTypes.Extensions;
import superValidateList = AttributeTypes.superValidateList;
import superFillDefaults = AttributeTypes.superFillDefaults;
import superValidateObject = AttributeTypes.superValidateObject;

const notInjectableKeys = /(^__)|([^\\]=$)|is|tags|elements|environments|components/;
const notInjectableKeysIncludingName = /(^__)|([^\\]=$)|is|name|tags|elements|environments|components/;

function keyMap(key: string) {
  return notInjectableKeys.test(key) ? '' : key;
}
function keyMapNoName(key: string) {
  return notInjectableKeysIncludingName.test(key) ? '' : key;
}

function createAssociate(reporter: Reporter, name: string,
  definition: MakeJS.Element, attrPath: AttributePath, parent: Element
) {
  return new AssociateElement('associate', name, parent);
}
Project.elementFactories.registerSimple('associate', createAssociate);
Project.elementExportsFactories.registerSimple('associate', createAssociate);
export class AssociateElement extends ComponentElement {
  static validate = Element.elementValidator('associate', AssociateElement);

  elements: any[] = [];
}

export namespace AssociateElement {
  export function superValidateAssociate<T extends object, T2 extends object, K>(
    reporter: Reporter, path: AttributePath, attr: T | AssociateElement | ComponentElement | object | undefined, a0: Target,
    validator: Validator<T, Target>,
    extensions: Extensions<T2, Target> | undefined, objectForKeyValidator: Validator<K, string> | undefined,
    keyMap: (key: string) => string,
    push: (elements: T[], component: T2 & { [s: string]: K }) => void
  ) {
    let elements = <T[]>[];
    let component = <T2 & { [s: string]: K }>{};
    if (attr instanceof AssociateElement) {
      injectElements(reporter, [attr], component, path, a0.attributes, keyMap);
      injectComponentsOf(reporter, attr, component, path, a0.attributes, keyMap);
      if (extensions) superValidateObject(reporter, path, component, a0, component, extensions, objectForKeyValidator);
      superValidateList(reporter, path, attr.elements, a0, validator, v => elements.push(v));
    }
    else if (attr instanceof ComponentElement) {
      let value = {};
      injectElements(reporter, [attr as ComponentElement], value, path, a0.attributes, keyMap);
      injectComponentsOf(reporter, attr as ComponentElement, value, path, a0.attributes, keyMap);
      if ((attr = validator(reporter, path, value, a0))) {
        Object.defineProperty(attr, "__path", { value: () => path.toString(), enumerable: false });
        elements.push(attr as T);
        if (extensions) superFillDefaults(extensions, component);
      }
    }
    else if (attr instanceof Element) {
      if ((attr = validator(reporter, path, attr, a0))) {
        elements.push(attr as T);
        if (extensions) superFillDefaults(extensions, component);
      }
    }
    else if ((attr = AttributeTypes.validateObject(reporter, path, attr))) { // TODO: remove as soon as possible (make.js before version 0.4)
      attr = { ...attr };
      if (attr["value"]) {
        path.push('.value');
        superValidateList(reporter, path, attr["value"], a0, validator, elements.push.bind(elements));
        path.pop();
        if (extensions) superValidateObject(reporter, path, attr, a0, component, extensions, objectForKeyValidator);
      }
      else if ((attr = validator(reporter, path, attr, a0))) {
        elements.push(attr as T);
        if (extensions) superFillDefaults(extensions, component);
      }
      if (attr) {
        Object.defineProperty(attr, "__path", { value: () => path.toString(), enumerable: false });
        path.diagnostic(reporter, { type: "note", msg: `a component is now expected (version >= 0.4), the value has been interpreted as a component` });
      }
    }
    if (elements.length > 0)
      push(elements, component);
    return elements;
  }
  export type Group<T extends object, T2 extends object> = {values: T[], ext: T2};
  export function groupValidator<T extends object, T2 extends object, K>(validator: Validator<T, Target>, extensions: Extensions<T2, Target> | undefined, objectForKeyValidator?: Validator<K, string>) {
    return function validateGroup(reporter: Reporter, path: AttributePath, attr, a0: Target) : Group<T, T2>[] {
      let ret = [] as Group<T, T2>[];
      let set = new Set<T>();
      let mapKey = extensions && "name" in extensions ? keyMap : keyMapNoName;
      superValidateList(reporter, path, attr, a0, (reporter: Reporter, path: AttributePath, attr: any) => {
        return superValidateAssociate(reporter, path, attr, a0, validator, extensions, objectForKeyValidator, mapKey, function validate(elements: T[], component: T2) {
          for (var key of elements) {
            if (set.has(key))
              path.diagnostic(reporter, { type: 'warning', msg: `attribute is present multiple times` });
            set.add(key);
          }
          ret.push({values: elements, ext: component});
        });
      }, function pusth() {});
      return ret;
    };
  }
  export function listValidator<T extends object>(validator: Validator<T, Target>, allowName) {
    let validateGroup = setValidator(validator, allowName);
    return function validatedSet2List(reporter: Reporter, path: AttributePath, attr, a0: Target) : T[] {
      return [...validateGroup(reporter, path, attr, a0)];
    };
  }
  export function setValidator<T extends object>(validator: Validator<T, Target>, allowName) {
    return function validateGroup(reporter: Reporter, path: AttributePath, attr, a0: Target) : Set<T> {
      let set = new Set<T>();
      superValidateList(reporter, path, attr, a0, (reporter: Reporter, path: AttributePath, attr: any) => {
        return superValidateAssociate(reporter, path, attr, a0, validator, {}, undefined, allowName ? keyMap : keyMapNoName,
        function validate(elements: T[], component: {}) {
          for (var key of elements)
            set.add(key);
        });
      }, function pusth() {});
      return set;
    };
  }
  export function mergedValidator<T extends object, K>(extensions: Extensions<T, Target>, objectForKeyValidator?: Validator<K, string>) : AttributeTypes.ValidatorNU<T & { [s: string]: K }, Target> {
    let validateObject = AttributeTypes.objectValidator<T, K, Target>(extensions, objectForKeyValidator);
    let validateGroup = setValidator(AttributeTypes.validateObject, extensions && "name" in extensions);
    return function validateMerged(reporter: Reporter, path: AttributePath, attr, a0: Target) : T & { [s: string]: K } {
      let values = [...validateGroup(reporter, path, attr, a0)];
      let ret = {} as T & { [s: string]: K };
      injectElements(reporter, values as Element[], ret, path, a0.attributes, undefined);
      return validateObject(reporter, path, ret, a0);
    };
  }
}
