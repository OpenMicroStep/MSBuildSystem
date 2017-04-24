import {Element, Project, Reporter, MakeJS, AttributePath, ComponentElement, AttributeTypes, Target, injectComponentsOf, injectElements} from '../index.priv';
import Validator = AttributeTypes.Validator;
import Extensions = AttributeTypes.Extensions;
import superValidateList = AttributeTypes.superValidateList;
import superFillDefaults = AttributeTypes.superFillDefaults;
import superFill = AttributeTypes.superFill;

const notInjectableKeys = /(^__)|([^\\]=$)|is|name|tags|elements|environments|components/;

function keyMap(key: string) {
  return notInjectableKeys.test(key) ? '' : key;
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
  function mapper<T2>(reporter: Reporter, extensions: Extensions<T2, Target> | undefined, a0: Target) {
    return extensions ? (at: AttributePath, key: string, value) => {
      let ext = extensions[key];
      if (ext)
        return ext.validator(reporter, at, value, a0);
      at.diagnostic(reporter, { type: "warning", msg: `attribute ${key} is unused` });
      return undefined;
    } : undefined;
  }
  export function superValidateAssociate<T extends object, T2 extends object>(
    reporter: Reporter, path: AttributePath, attr: T | AssociateElement | ComponentElement | object | undefined, a0: Target,
    validator: Validator<T, Target>, extensions: Extensions<T2, Target> | undefined,
    push: (elements: T[], component: T2) => void
  ) {
    let elements = <T[]>[];
    let component = <T2>{};
    if (attr instanceof AssociateElement) {
      let mapValue = mapper(reporter, extensions, a0);
      injectElements(reporter, [attr], component, path, a0.attributes, keyMap, mapValue);
      injectComponentsOf(reporter, attr, component, path, a0.attributes, keyMap, mapValue);
      if (extensions) superFill(reporter, path, component, a0, component, extensions);
      superValidateList(reporter, path, attr.elements, a0, validator, v => elements.push(v));
    }
    else if (attr instanceof ComponentElement) {
      let value = {};
      injectElements(reporter, [attr as ComponentElement], value, path, a0.attributes, keyMap);
      injectComponentsOf(reporter, attr as ComponentElement, value, path, a0.attributes, keyMap);
      if ((attr = validator(reporter, path, value, a0))) {
        elements.push(attr as T);
        if (extensions) superFillDefaults(extensions, component);
      }
    }
    else if ((attr = AttributeTypes.validateObject(reporter, path, attr))) { // TODO: remove as soon as possible (make.js before version 0.4)
      if (attr["value"]) {
        path.push('.value');
        superValidateList(reporter, path, attr["value"], a0, validator, elements.push.bind(elements));
        path.pop();
        if (extensions) superFill(reporter, path, attr, a0, component, extensions);
      }
      else if ((attr = validator(reporter, path, attr, a0))) {
        elements.push(attr as T);
        if (extensions) superFillDefaults(extensions, component);
      }
      if (attr) {
        attr["__path"] = () => path.toString();
        path.diagnostic(reporter, { type: "note", msg: `a component is now expected (version >= 0.4), the value has been interpreted as a component` });
      }
    }
    if (elements.length > 0)
      push(elements, component);
    return elements;
  }
  export type Group<T extends object, T2 extends object> = {values: T[], ext: T2};
  export function groupValidator<T extends object, T2 extends object>(validator: Validator<T, Target>, extensions: Extensions<T2, Target> | undefined) {
    return function validateGroup(reporter: Reporter, path: AttributePath, attr, a0: Target) : Group<T, T2>[] {
      let ret = [] as Group<T, T2>[];
      let set = new Set<T>();
      superValidateList(reporter, path, attr, a0, (reporter: Reporter, path: AttributePath, attr: any) => {
        return superValidateAssociate(reporter, path, attr, a0, validator, extensions, function validate(elements: T[], component: T2) {
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
  export function listValidator<T extends object>(validator: Validator<T, Target>) {
    let validateGroup = setValidator(validator);
    return function validatedSet2List(reporter: Reporter, path: AttributePath, attr, a0: Target) : T[] {
      return [...validateGroup(reporter, path, attr, a0)];
    };
  }
  export function setValidator<T extends object>(validator: Validator<T, Target>) {
    return function validateGroup(reporter: Reporter, path: AttributePath, attr, a0: Target) : Set<T> {
      let set = new Set<T>();
      superValidateList(reporter, path, attr, a0, (reporter: Reporter, path: AttributePath, attr: any) => {
        return superValidateAssociate(reporter, path, attr, a0, validator, {}, function validate(elements: T[], component: {}) {
          for (var key of elements)
            set.add(key);
        });
      }, function pusth() {});
      return set;
    };
  }
  export function mergedValidator<T extends object>(extensions: Extensions<T, Target> | undefined) {
    let validateObject = extensions ? AttributeTypes.objectValidator<T, Target>(extensions) : AttributeTypes.validateObject;
    let validateGroup = setValidator(validateObject);
    return function validateMerged(reporter: Reporter, path: AttributePath, attr, a0: Target) : T {
      let values = [...validateGroup(reporter, path, attr, a0)];
      let ret = {} as T;
      let mapValue = mapper(reporter, extensions, a0);
      injectElements(reporter, values as Element[], ret, path, a0.attributes, undefined, mapValue);
      return ret;
    };
  }
  export function mergedDynValidator<T extends object>(validator: Validator<T, Target>) {
    let validateGroup = setValidator(validator);
    return function validateMerged(reporter: Reporter, path: AttributePath, attr, a0: Target) : T {
      let values = [...validateGroup(reporter, path, attr, a0)];
      let ret = {} as T;
      injectElements(reporter, values as any, ret, path, a0.attributes);
      return ret;
    };
  }
}
