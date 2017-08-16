import {
  Reporter, AttributePath, AttributeTypes,
  util, createProviderMap, ProviderMap,
  Diagnostic, Parser
} from './index';
import * as Q from './query';
export interface ElementDefinition {
  is: string;
  name?: any;
  [s: string]: any;
}

export type ElementFactory = (reporter: Reporter, name: string | undefined,
  definition: ElementDefinition, attrPath: AttributePath, parent: Element, allowNoName: boolean) => Element[];
export type SimpleElementFactory = (reporter: Reporter, name: string,
  definition: ElementDefinition, attrPath: AttributePath, parent: Element) => Element | undefined;
export type ElementFactoriesProviderMap = ProviderMap<ElementFactory> & {
  registerSimple(name: string, factory: SimpleElementFactory),
  warningProbableMisuseOfKey: Set<string>,
};
export type ElementLoadContext = {
  elementFactoriesProviderMap: ElementFactoriesProviderMap,
  reporter: Reporter
}

export function createElementFactoriesProviderMap(name: string) : ElementFactoriesProviderMap {
  let p = createProviderMap<ElementFactory>(name);
  function registerSimple(name: string, factory: SimpleElementFactory) {
    p.register([name], function simpleElementFactory(
      reporter: Reporter, name: string | undefined,
      definition: ElementDefinition, attrPath: AttributePath, parent: Element, allowNoName
    ) : Element[] {
      name = handleSimpleElementName(reporter, name, definition.name, attrPath, allowNoName);
      let el = name !== undefined ? factory(reporter, name, definition, attrPath, parent) : undefined;
      return el ? [el] : [];
    });
  }
  return Object.assign(p, {
    registerSimple: registerSimple,
    warningProbableMisuseOfKey: new Set<string>(["tags"])
  });
}

function handleSimpleElementName(reporter: Reporter, namespaceName: string | undefined, definitionName: string | undefined, attrPath: AttributePath, allowNoName: boolean) {
  if (!namespaceName) {
    if (typeof definitionName === 'string' && definitionName.length > 0)
      namespaceName = definitionName;
    else if (!allowNoName)
      attrPath.diagnostic(reporter, { type: 'error', msg: `'name' attribute must be a non empty string` });
    else
      namespaceName = "";
  }
  else if (typeof definitionName === 'string' && namespaceName !== definitionName) {
    attrPath.diagnostic(reporter, { type: 'error', msg: `'name' attribute is already defined by the namespace with a different value` });
  }
  return namespaceName;
}

function elementValidator<T extends object, A0 extends Element & T>(extensions: AttributeTypes.Extensions<T, A0>) : AttributeTypes.ValidatorT<void, Element> {
  function validateObject(reporter: Reporter, path: AttributePath, attr: Element, element: Element) : void {
    AttributeTypes.superValidateObject(reporter, path, attr, element, element as any, extensions, AttributeTypes.validateAnyToUndefined);
  };
  return { validate: validateObject, traverse: (lvl, ctx) => `object with` };
}

interface ElementValidation {
  __factoryKeys: Set<String>;
  __extensions: AttributeTypes.Extension<Partial<Element>, Element>;
  __validator: AttributeTypes.Validator<void, Element>;
}

export class Element {
  // On the prototype
  readonly __factoryKeys: Set<String>;
  readonly __extensions: AttributeTypes.Extension<Partial<Element>, Element>;
  readonly __validator: AttributeTypes.Validator<void, Element>;

  ___path: string | undefined;
  __parent: Element | null;
  protected __resolved: boolean;
  is: string;
  name: string;
  tags: string[];

  static createElementFactoriesProviderMap = createElementFactoriesProviderMap;

  static registerAttributes<D extends AttributeTypes.Extensions<A, T>, A extends { [K in keyof D]: T[K] }, T extends Element & A>(
    cstor: { new? (...args) : T, prototype: typeof Element.prototype }, factoryKeys: string[], attributes: AttributeTypes.Extensions<A, T>
  ) {
    let p = cstor.prototype as ElementValidation;
    if (p.hasOwnProperty('__extensions') || p.hasOwnProperty('__validator') || p.hasOwnProperty('__factoryKeys'))
      throw new Error(`registerAttributes can only be called once per Element class`);

    let extensions = p.__extensions ? { ...p.__extensions, ...attributes as object } : attributes;
    let fkeys = factoryKeys.length > 0 ? new Set([...(p.__factoryKeys || []), ...factoryKeys]) : p.__factoryKeys;
    Object.defineProperties(p, {
      __factoryKeys: { enumerable: false, writable: false, value: fkeys },
      __extensions: { enumerable: false, writable: false, value: extensions },
      __validator: { enumerable: false, writable: false, value: elementValidator(extensions) },
    });
  }

  static isNamespace(value: string) : boolean { return typeof value === 'string' && value.endsWith('='); }
  static name2namespace(name: string) { return name + '='; }
  static namespace2name(namespace: string) { return namespace.substring(0, namespace.length - 1); }

  static isReference(value: string) : boolean { return typeof value === 'string' && value.startsWith('='); }
  static name2reference(name: string) { return '=' + name; }
  static reference2name(reference: string) { return reference.substring(1); }

  static isReserved(value: string) : boolean {
    return typeof value === 'string' && value.startsWith('__');
  }

  static asValue(value: any) {
    return typeof value === 'object' ? Object.freeze(value) : value;
  }
  static isValue(value: any) {
    return typeof value === 'object' ? Object.isFrozen(value) : true;
  }
  static keepIsValue(oldValue, newValue) {
    return Element.isValue(oldValue) ? Element.asValue(newValue) : newValue;
  }

  constructor(is: string, name: string, parent: Element | null) {
    this.___path = undefined;
    this.__parent = parent;
    this.__resolved = false;
    this.is = is;
    this.name = name;
    this.tags = [];
  }

  static load<T extends Element>(reporter: Reporter, definition: ElementDefinition, root: T, elementFactoriesProviderMap: ElementFactoriesProviderMap) {
    let context = {
      elementFactoriesProviderMap: elementFactoriesProviderMap,
      reporter: reporter
    };
    reporter.transform.push(Reporter.transformWithCategory('load'));
    root.__load(context, definition, new AttributePath(root));
    reporter.transform.pop();
    reporter.transform.push(Reporter.transformWithCategory('resolve'));
    root.__resolved = false; // force resolution
    root.__resolve(reporter);
    reporter.transform.pop();
    return root;
  }

  static instantiate(context: ElementLoadContext, name: string | undefined, definition: ElementDefinition, attrPath: AttributePath, parent: Element, allowNoName = false) : Element[] {
    var is = definition.is;
    var error: string | undefined;
    if (typeof is !== 'string')
      error = `'is' attribute must be a string`;
    else {
      var factory = context.elementFactoriesProviderMap.find(is);
      if (!factory)
        error = `{ is: '${is}' } attribute must be a valid element type (ie, one of: ${[...context.elementFactoriesProviderMap.map.keys()].join(', ')})`;
      else {
        attrPath = name ? new AttributePath(parent, ':', name) : attrPath;
        var elements = factory(context.reporter, name, definition, attrPath, parent, allowNoName);
        for (var element of elements) {
          if (!element.name && elements.length === 1)
              element.___path = attrPath.toString();
          element.__load(context, definition, new AttributePath(element));
        }
        return elements;
      }
    }
    attrPath.diagnostic(context.reporter, { type: "error", msg: error }, '.is');
    return [];
  }

  __keyMeaning(key: string) : Element.KeyMeaning {
    if (Element.isNamespace(key))
      return Element.KeyMeaning.Namespace;
    else if (Element.isReserved(key))
      return Element.KeyMeaning.Private;
    else if (this.__factoryKeys.has(key) || key in this.__extensions)
      return Element.KeyMeaning.Element;
    return Element.KeyMeaning.User;
  }

  ///////////////////
  // Load definitions
  __load(context: ElementLoadContext, definition: ElementDefinition, attrPath: AttributePath) {
    attrPath.push('', '');
    for (var k in definition) {
      var v = definition[k];
      if (Element.isNamespace(k)) {
        var n = Element.namespace2name(k);
        attrPath.rewrite(':', n);
        if (Element.isReference(v)) {
          this.__loadNamespace(context, n, [v], attrPath);
        }
        else if (typeof v === 'object') {
          // namespace definition
          var els = Element.instantiate(context, n, v, attrPath, this);
          this.__loadNamespace(context, n, els, attrPath);
        }
        else {
          attrPath.diagnostic(context.reporter, { type: 'error', msg: `an element definition or reference was expected` });
        }
      }
      else if (!this.__factoryKeys.has(k)) {
        attrPath.rewrite('.', k);
        if (!(k in this.__extensions) && context.elementFactoriesProviderMap.warningProbableMisuseOfKey.has(k)) {
          attrPath.diagnostic(context.reporter, { type: 'note', msg: `'${k}' could be misused, this key has special meaning for other element types` });
        }
        this[k] = this.__loadValue(context, v, attrPath);
      }
    }
    attrPath.pop(2);
  }

  __loadValue(context: ElementLoadContext, value: any, attrPath: AttributePath) {
    let newValue = value;
    if (typeof value === "object") {
      if (Array.isArray(value))
        newValue = this.__loadArray(context, value, [], attrPath);
      else
        newValue = this.__loadObject(context, value, {}, attrPath);
    }
    return Element.keepIsValue(value, newValue);
  }
  __loadObject<T>(context: ElementLoadContext, object: {[s: string]: any}, into: {[s: string]: T}, attrPath: AttributePath, validator?: AttributeTypes.Validator<T, Element>) {
    if ("is" in object) {
      var subs = Element.instantiate(context, undefined, <ElementDefinition>object, attrPath, this, true);
      if (subs.length !== 1)
        attrPath.diagnostic(context.reporter, { type: 'error', msg: `definition of multiple elements were only one was expected` });
      else
        return subs[0];
    }

    attrPath.push('.', '');
    for (var k in object) {
      var v = this.__loadValue(context, object[k], attrPath.set(k));
      if (context.elementFactoriesProviderMap.warningProbableMisuseOfKey.has(k)) {
        attrPath.diagnostic(context.reporter, { type: 'note', msg: `'${k}' could be misused, this key has special meaning for some elements` });
      }
      into[k] = validator ? validator.validate(context.reporter, attrPath, v, this) : v;
    }
    attrPath.pop(2);
    return into;
  }
  __loadArray(context: ElementLoadContext, values: any[], into: any[], attrPath: AttributePath) {
    attrPath.pushArray();
    for (var i = 0, len = values.length; i < len; ++i) {
      var v = values[i];
      if (typeof v === "object") {
        attrPath.setArrayKey(i);
        if (Array.isArray(v))
          into.push(this.__loadArray(context, v, <any[]>[], attrPath));
        else
          this.__loadObjectInArray(context, v, into, attrPath);
      }
      else {
        into.push(v);
      }
    }
    attrPath.popArray();
    return into;
  }
  __loadObjectInArray(context: ElementLoadContext, object: {[s: string]: any}, into: any[], attrPath: AttributePath) {
    if ("is" in object) {
      var subs = Element.instantiate(context, undefined, <ElementDefinition>object, attrPath, this, true);
      for (var j = 0, jlen = subs.length; j < jlen; ++j) {
        var sub = subs[j];
        if (sub && sub.name) {
          var k = Element.name2namespace(sub.name);
          if (k in this)
            attrPath.diagnostic(context.reporter, { type: 'error', msg: `conflict with an element defined with the same name: '${sub.name}'` });
          this[k] = sub;
        }
      }
      into.push(...subs);
    }
    else {
      into.push(this.__loadObject(context, object, {}, attrPath));
    }
  }
  __loadNamespace(context: ElementLoadContext, name: string, els: (Element | string)[], attrPath: AttributePath) {
    if (els.length > 1)
      attrPath.diagnostic(context.reporter, { type: 'warning', msg: `element has been expanded to a multiple elements and can't be referenced` });
    if (els.length === 1) {
      name = Element.name2namespace(name);
      if (name in this)
        attrPath.diagnostic(context.reporter, { type: 'error', msg:  `conflict with an element defined with the same name: '${Element.namespace2name(name)}'` });
      this[name] = els[0];
    }
  }
  // Load definitions
  ///////////////////

  ///////////////////
  // Resolve elements
  __resolve(reporter: Reporter, at: AttributePath = new AttributePath(this)) {
    if (!this.__resolved) {
      this.__resolved = true;
      this.__resolveWithPath(reporter, at);
      this.__validate(reporter, at);
    }
  }
  __resolveWithPath(reporter: Reporter, attrPath: AttributePath) {
    this.__resolveValuesInObject(reporter, this, this, attrPath);
  }
  __resolveValueForKey(reporter: Reporter, v, k: string, attrPath: AttributePath) {
    if (Element.isNamespace(k)) {
      (v as Element).__resolve(reporter);
    }
    else if (Array.isArray(v)) {
      this[k] = this.__resolveValuesInArray(reporter, v, attrPath);
    }
    else if (typeof v === 'object') {
      this[k] = this.__resolveValuesInObject(reporter, v, {}, attrPath);
    }
  }
  __resolveValuesInObject(reporter: Reporter, object: { [s: string]: any}, into: { [s: string]: any}, attrPath: AttributePath) : { [s: string]: any[]} {
    attrPath.push('.', '');
    for (var key in object) { if (Element.isReserved(key)) continue;
      var v = object[key];
      into[key] = this.__resolveAnyValue(reporter, key, v, attrPath.set(key));
    }
    attrPath.pop(2);
    return into;
  }
  __resolveAnyValue(reporter: Reporter, key: string, value, attrPath: AttributePath) {
    if (typeof value === "object") {
      if (Array.isArray(value))
        return Element.keepIsValue(value, this.__resolveValuesInArray(reporter, value, attrPath));
      if (value instanceof Element) {
        value.__resolve(reporter);
        return value;
      }
      return Element.keepIsValue(value, this.__resolveValuesInObject(reporter, value, {}, attrPath));
    }
    else if (Element.isReference(value)) {
      let ret: Element[] = [];
      this.__resolveElements(reporter, ret, value, attrPath);
      if (ret.length > 1)
        attrPath.diagnostic(reporter, { type: 'warning', msg: `can't reference multiple elements here`, notes: [
          { type: "note", msg: "did you forget the [] ?" },
        ]});
      else if (ret.length === 0)
        attrPath.diagnostic(reporter, { type: 'warning', msg: `must reference at least one element` });
      if (Element.isNamespace(key) && ret.length === 1 && ret[0].name && ret[0].name !== Element.namespace2name(key))
        attrPath.diagnostic(reporter, { type: 'warning', msg: `element alias must have the same name` });
      return ret[0];
    }
    return value;
  }
  __resolveValuesInArray(reporter: Reporter, values: any[], attrPath: AttributePath) : any[] {
    var ret: any[] = [];
    attrPath.pushArray();
    for (var i = 0, len = values.length; i < len; ++i)
      this.__resolveValueInArray(reporter, values[i], ret, attrPath.setArrayKey(i));
    attrPath.popArray();
    return ret;
  }
  __resolveValueInArray(reporter: Reporter, el, ret: any[], attrPath: AttributePath) {
    if (Element.isReference(el))
      this.__resolveElements(reporter, ret, el, attrPath);
    else if (el instanceof Element)
      el.__resolveInto(reporter, ret);
    else
      ret.push(this.__resolveAnyValue(reporter, '', el, attrPath));
  }
  __resolveInto(reporter: Reporter, ret: any[]) {
    this.__resolve(reporter);
    ret.push(this);
  }
  // Resolve elements
  ///////////////////

  ///////////////////
  // Validate
  __validate(reporter: Reporter, at: AttributePath) {
    this.__validator.validate(reporter, at, this, this);
  }
  // Validate
  ///////////////////

  __root() : Element {
    return this.__parent ? this.__parent.__root() : this;
  }

  __path() {
    return this.___path || (this.__parent ? `${this.__parent.__path()}:${this.name}` : (this.name || ''));
  }

  resolveElements(reporter: Reporter, query: string) : Element[] {
    let ret: Element[] = [];
    this.__resolveElements(reporter, ret, query, undefined);
    return ret;
  }

  __passTags(tags: Element.Query) : boolean {
    let requiredTagsLen = tags.requiredTags.length;
    let rejectedTagsLen = tags.rejectedTags.length;
    let i: number;
    let ok = ((this.tags && this.tags.length) || 0) >= requiredTagsLen;
    for (i = 0; ok && i < requiredTagsLen; ++i)
      ok = this.tags.indexOf(tags.requiredTags[i]) !== -1;
    for (i = 0; ok && i < rejectedTagsLen; ++i)
      ok = this.tags.indexOf(tags.rejectedTags[i]) === -1;
    return ok;
  }

  __resolveElementsGroup(reporter: Reporter, into: Element[], steps: string[], query: Element.Query, attrPath: AttributePath) {
    let el: Element | undefined = this;
    for (let i = 0; el && i < steps.length; i++) {
      let step = steps[i];
      if (step.length === 0) {
        if (steps.length > 1)
          attrPath.diagnostic(reporter, {
            type: "warning",
            msg: `one the groups is an empty string, the group '${steps.join(':')}' is ignored`,
          });
        break;
      }
      let stepeq = Element.name2namespace(step);
      let found = el[stepeq];
      if (i === 0) {
        while (typeof found !== 'object' && el.__parent) {
          el = el.__parent;
          found = el[stepeq];
        }
      }
      el = found;
    }
    if (!el) {
      attrPath.diagnostic(reporter, {
        type: "warning",
        msg: `query '${Element.rebuildQuery({ ...query, groups: [steps] })}' refer to an element that can't be found, the group '${steps.join(':')}' is ignored`,
      });
    }
    else
      el.__resolveElementsGroupIn(reporter, into, query);
  }
  __resolveElementsGroupIn(reporter: Reporter, into: Element[], query: Element.Query) {
    if (this.__passTags(query)) {
      this.__resolve(reporter);
      this.__resolveElementsGroupPush(reporter, into, query);
    }
  }
  __resolveElementsGroupPush(reporter: Reporter, into: Element[], query: Element.Query) {
    if (query.explicitAttributes) {
      into.push(util.clone(this, k => Element.isReserved(k) || query.explicitAttributes!.has(k)));
    }
    else if (query.removedAttributes) {
      into.push(util.clone(this, k => Element.isReserved(k) || !query.removedAttributes!.has(k)));
    }
    else if (query.method) {
      if (Element.isReserved(query.method))
        reporter.diagnostic({ type: 'error', msg: `cannot call '${query.method}': method is private`, path: this.__path() });
      else {
        if (typeof this[query.method] !== 'function')
          reporter.diagnostic({ type: 'error', msg: `cannot call '${query.method}': not a method`, path: this.__path() });
        else
          into.push(this[query.method]());
      }
    }
    else {
      into.push(this);
    }
  }

  __resolveElements(reporter: Reporter, into: Element[], query: string, attrPath: AttributePath | undefined = new AttributePath()) {
    let parser = new Parser(new Reporter(), query);
    let ret = Q.parseQuery(parser);
    if (!parser.reporter.failed) {
      for (let group of ret.groups)
        this.__resolveElementsGroup(reporter, into, group, ret, attrPath);
    }
    if (parser.reporter.diagnostics.length) {
      reporter.diagnostic({
        type: "warning",
        msg: `unable to parse query: ${query}`,
        notes: parser.reporter.diagnostics,
      });
    }
  }

  toJSON() {
    return serialize(this, [], false);
  }
}
Element.registerAttributes(Element, ['is', 'name'], {
  tags: AttributeTypes.validateStringList
});
function isAlreadyDefined(element: Element, stack: Element[]) {
  let n = Element.name2namespace(element.name);
  for (let i = stack.length; i > 0; ) {
    let e = stack[--i][n];
    if (e === element)
      return true;
    if (e)
      return false;
  }
  return false;
}
function serialize(element: any, stack: Element[], isNamespace: boolean) : any {
  let ret: any = element;
  if (element instanceof Object) {
    if (element instanceof Set || element instanceof Array) {
      ret = [];
      for (let e of element)
        ret.push(serialize(e, stack, false));
    }
    else if (element instanceof Element) {
      if (!isNamespace && element.name && isAlreadyDefined(element, stack))
        ret = Element.name2reference(element.name);
      else {
        ret = {};
        stack.push(element);
        for (let key of Object.getOwnPropertyNames(element)) {
          if (!Element.isReserved(key)) {
            ret[key] = serialize(element[key], stack, Element.isNamespace(key));
          }
        }
        stack.pop();
      }
    }
    else {
      ret = {};
      for (let key of Object.getOwnPropertyNames(element)) {
        ret[key] = serialize(element[key], stack, false);
      }
    }
  }
  return ret;
}

export namespace Element {
  export enum KeyMeaning {
    User = 0,
    Private,
    Namespace,
    Element,
  };
  export type Query = Q.Query;
  export const parseQuery = Q.parseQuery;
  export function rebuildQuery(query: Element.Query) {
    let ret = query.groups.map(s => s.join(':')).join(' + ');
    if (query.rejectedTags.length || query.requiredTags.length)
      ret += ' ? ' + query.requiredTags.concat(query.rejectedTags.map(t => `!${t}`)).join(' + ');
    return ret;
  }

  export const validateElement = {
    validate: function validateElement(reporter: Reporter, path: AttributePath, value: any) {
      if (!(value instanceof Element))
        path.diagnostic(reporter, { type: "warning", msg: `attribute must be an element, got a ${util.limitedDescription(value)}` });
      else
        return value;
      return undefined;
    }
  };

  export function elementIsValidator<T extends Element>(isList: string[]) : AttributeTypes.ValidatorT0<T> {
    function validateElementIs(reporter: Reporter, path: AttributePath, cmp: any) {
      cmp = validateElement.validate(reporter, path, cmp);
      if (cmp !== undefined && isList.indexOf(cmp.is) === -1) {
        path.diagnostic(reporter, {
          type: 'error',
          msg:  `only elements of type ${JSON.stringify(isList)} are accepted, got ${JSON.stringify({is: cmp.is, name: cmp.name})}`
        });
        cmp = undefined;
      }
      return cmp;
    };
    return { validate: validateElementIs, traverse(lvl, ctx) {
      return `${isList.join(' / ')} element`;
    }};
  }
  export function elementValidator<T extends Element>(is: string, cls: { new(...args): T }) : AttributeTypes.ValidatorT0<T> {
    function validateElementIs(reporter: Reporter, path: AttributePath, value: any) {
      if ((value = validateElement.validate(reporter, path, value)) !== undefined && value.is === is && value instanceof cls)
        return <T>value;
      if (value !== undefined)
        path.diagnostic(reporter, { type: "warning", msg: `attribute must be a '${is}' element, got a ${value.is}`});
      return undefined;
    };
    return { validate: validateElementIs, traverse(lvl, ctx) {
      return `${is} element`;
    } };
  }

  export interface GroupElement extends Element {
     elements: Element[];
  };
  export function DynGroupElement<C extends { new(...args): Element, prototype: Element }>(parentClass: C) : ({
    new (...args: any[]): GroupElement;
    prototype: GroupElement;
  } & C) {
    class GroupElementImpl extends parentClass {
      elements: Element[] = [];

      __resolveElementsGroupIn(reporter: Reporter, into: Element[], tags: Element.Query) {
        this.__resolve(reporter);
        for (let el of this.elements)
          el.__resolveElementsGroupIn(reporter, into, tags);
      }

      __resolveInto(reporter: Reporter, ret: any[]) {
        this.__resolve(reporter);
        ret.push(...this.elements);
      }

      __validate(reporter: Reporter, at: AttributePath) {
        super.__validate(reporter, at); // force elements: Element[]
        if (this.elements.length > 0)
          this.__flatten(reporter, at);
      }

      __flatten(reporter: Reporter, at: AttributePath) { // flatten elements
        let elements: Element[] = [];
        let groups: GroupElementImpl[] = [];
        let is: string | undefined = undefined;
        let attributes = Object.keys(this).filter(key => !this.__keyMeaning(key));
        at.push('.elements[', '', ']');
        for (let i = 0, len = this.elements.length; i < len; i++) {
          let el = this.elements[i];
          at.setArrayKey(i);
          if (!(el instanceof Element)) {
            at.diagnostic(reporter, {
              type: 'error',
              msg:  `expecting an element, got ${typeof el}`
            });
          }
          else if (el instanceof GroupElementImpl) {
            pushGroup(this, el);
          }
          else if (canPush(el))
            elements.push(el);
        }
        at.pop(3);
        if (attributes.length > 0) {
          let mel = util.clone<GroupElementImpl>(this, k => true);
          mel.elements = elements;
          groups.push(mel);
          this.elements = groups;
        }
        else {
          this.elements = [...groups, ...elements];
        }

        function pushGroup(self, sub: GroupElementImpl) {
          sub.__resolve(reporter); // sub.elements = Element | { elements: Element[], ...attrs }
          let subattributes = Object.keys(sub).filter(key => !sub.__keyMeaning(key));

          if (subattributes.length > 0) {
            let mel = util.clone<GroupElementImpl>(sub, k => true);
            for (let key of attributes)
              if (!(key in mel))
                mel[key] = self[key];
            if (canPush(mel.elements[0])) // no need to check for other elements, sub already did it at its own resolve step
              groups.push(mel);
          }
          else {
            let sat = sub.name ? new AttributePath(sub) : at.push('.elements[', '', ']');
            for (let i = 0, len = sub.elements.length; i < len; ++i) {
              let el = sub.elements[i];
              sat.setArrayKey(i);
              if (canPush(el))
                elements.push(el);
            }
            if (sat === at)
              at.pop(3);
          }
        }

        function canPush(el: Element) {
          let el_is = el.is;
          if (is === undefined)
            is = el_is;
          let ok = is === el_is;
          if (!ok)
            at.diagnostic(reporter, { type: 'error', msg:  `elements must be of the same type, expecting ${is}, got ${el_is}` });
          return ok;
        }
      }
    };
    Element.registerAttributes(GroupElementImpl, [], {
      elements: AttributeTypes.listValidator(Element.validateElement)
    });
    return GroupElementImpl;
  }
}
