import {
  Reporter, AttributePath, AttributeTypes,
  util, createProviderMap, ProviderMap,
  Diagnostic, transformWithCategory, Parser
} from './index';

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
  static reference2query(name: string) { return name.substring(1); }
  static isReserved(value: string) : boolean {
    return typeof value === 'string' && value.startsWith('__');
  }

  constructor(is: string, name: string, parent: Element | null) {
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
    reporter.transform.push(transformWithCategory('load'));
    root.__load(context, definition, new AttributePath(root));
    reporter.transform.pop();
    reporter.transform.push(transformWithCategory('resolve'));
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
        error = `'is' attribute must be a valid element type`;
      else {
        attrPath = name ? new AttributePath(parent, ':', name) : attrPath;
        var elements = factory(context.reporter, name, definition, attrPath, parent, allowNoName);
        for (var element of elements)
          element.__load(context, definition, new AttributePath(element));
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
    if (typeof value === "object") {
      if (Array.isArray(value))
        return this.__loadArray(context, value, [], attrPath);
      return this.__loadObject(context, value, {}, attrPath);
    }
    return value;
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
  __loadArray<T>(context: ElementLoadContext, values: any[], into: T[], attrPath: AttributePath, validator?: AttributeTypes.Validator<T, Element>) {
    attrPath.pushArray();
    for (var i = 0, len = values.length; i < len; ++i) {
      var v = values[i];
      if (typeof v === "object") {
        attrPath.setArrayKey(i);
        if (Array.isArray(v))
          this.__push(context.reporter, into, attrPath, validator, this.__loadArray(context, v, <any[]>[], attrPath));
        else
          this.__loadObjectInArray(context, v, into, attrPath);
      }
      else {
        this.__push(context.reporter, into, attrPath, validator, v);
      }
    }
    attrPath.popArray();
    return into;
  }
  __loadObjectInArray<T>(context: ElementLoadContext, object: {[s: string]: any}, into: T[], attrPath: AttributePath, validator?: AttributeTypes.Validator<T, Element>) {
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
      this.__pushArray(context.reporter, into, attrPath, validator, subs);
    }
    else {
      this.__push(context.reporter, into, attrPath, validator, this.__loadObject(context, object, {}, attrPath));
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
  __push<T>(reporter: Reporter, into: T[], attrPath: AttributePath, validator: AttributeTypes.Validator<T, Element> | undefined, value) {
    if (!validator || (value = validator.validate(reporter, attrPath, value, this)) !== undefined)
      into.push(value);
  }
  __pushArray<T>(reporter: Reporter, into: T[], attrPath: AttributePath, validator: AttributeTypes.Validator<T, Element> | undefined, values: any[]) {
    attrPath.pushArray();
    for (var i = 0, len = values.length; i < len; i++) {
      var value = values[i];
      if (!validator || (value = validator.validate(reporter, attrPath.setArrayKey(i), value, this)) !== undefined)
        into.push(value);
    }
    attrPath.popArray();
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
        return this.__resolveValuesInArray(reporter, value, attrPath);
      if (value instanceof Element) {
        value.__resolve(reporter);
        return value;
      }
      return this.__resolveValuesInObject(reporter, value, {}, attrPath);
    }
    else if (Element.isReference(value)) {
      let ret: Element[] = [];
      this.__resolveElements(reporter, ret, Element.reference2query(value), attrPath);
      if (ret.length > 1)
        attrPath.diagnostic(reporter, { type: 'warning', msg: `can't reference multiple elements here` });
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
      this.__resolveElements(reporter, ret, Element.reference2query(el), attrPath);
    else
      ret.push(this.__resolveAnyValue(reporter, '', el, attrPath));
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
    var p = "";
    var element: Element | null = this;
    while (element) {
      p = p ? (element.name + ":" + p) : (element.name || "");
      element = element.__parent;
    }
    return p;
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

  __parseQuery(reporter: Reporter, into: Element[], parser: Parser, attrPath: AttributePath) : Element.Query {
    parser.skip(Parser.isAnySpaceChar);
    let ret: Element.Query = {
      groups: [],
      requiredTags: [],
      rejectedTags: [],
      explicitAttributes: undefined,
      removedAttributes: undefined,
      method: undefined
    };
    let level = parser.test('{');
    parser.skip(Parser.isAnySpaceChar);
    if (parser.ch !== '?') {
      this.__parseGroups(parser, ret);
      parser.skip(Parser.isAnySpaceChar);
    }
    if (parser.test('?')) {
      this.__parseTags(parser, ret);
      parser.skip(Parser.isAnySpaceChar);
    }
    if (level && parser.consume('}')) {
      parser.skip(Parser.isAnySpaceChar);
      if (parser.ch === '.')
        ret.method = parser.while(Parser.isWordChar, 1);
      else
        this.__parseAttributes(parser, ret);
      parser.skip(Parser.isAnySpaceChar);
    }
    if (!parser.atEnd() && !parser.reporter.failed)
      parser.error(`query is not fully parsed`);
    return ret;
  }
  __parseGroups(parser: Parser, ret: Element.Query) {
    do {
      ret.groups.push(parser.while(ch => ch !== '+' && ch !== '?', 1).split(':').map(g => g.trim()));
    } while (parser.test('+'));
  }
  __parseTags(parser: Parser, ret: Element.Query) {
    do {
      if (parser.test('!')) {
        parser.skip(Parser.isAnySpaceChar);
        ret.rejectedTags.push(parser.while(ch => ch !== '+', 1).trim());
      }
      else {
        ret.requiredTags.push(parser.while(ch => ch !== '+', 1).trim());
      }
    } while (parser.test('+'));
  }
  __parseAttributes(parser: Parser, ret: Element.Query) {
    function parseAttrs(prefix: string, list: Set<string>) {
      while (parser.test(prefix)) {
        parser.skip(Parser.isAnySpaceChar);
        list.add(parser.while(ch => ch !== prefix && ch !== '}', 1).trim());
      }
    }
    if (parser.ch === '+')
      parseAttrs('+', ret.explicitAttributes = new Set());
    else if (parser.ch === '-')
      parseAttrs('+', ret.removedAttributes = new Set());
    else
      parser.error(`explicit or exclusion attributes list expected`);
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
      if (query.explicitAttributes) {
        let o = Object.create(this.constructor.prototype);
        for (let k of Object.getOwnPropertyNames(o)) {
          if (Element.isReserved(k))
            o[k] = this[k];
          else if (query.explicitAttributes.has(k))
            o[k] = this[k];
        }
      }
      else if (query.removedAttributes) {
        let o = Object.create(this.constructor.prototype);
        for (let k of Object.getOwnPropertyNames(o)) {
          if (Element.isReserved(k))
            o[k] = this[k];
          else if (!query.removedAttributes.has(k))
            o[k] = this[k];
        }
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
  }

  __resolveElements(reporter: Reporter, into: Element[], query: string, attrPath: AttributePath | undefined = new AttributePath()) {
    let parser = new Parser(new Reporter(), query);
    let ret = this.__parseQuery(reporter, into, parser, attrPath);
    if (!parser.reporter.failed) {
      for (let group of ret.groups)
        this.__resolveElementsGroup(reporter, into, group, ret, attrPath);
    }
    reporter.aggregate(parser.reporter);
  }

  toJSON() {
    return serialize(this);
  }
}
Element.registerAttributes(Element, ['is', 'name'], {
  tags: AttributeTypes.validateStringList
});

function serialize(element: Element) {
  if (typeof element === "object") {
    if (Array.isArray(element)) {
      return element.map(e => serialize(e));
    }
    else {
      let k, v, copy = {};
      for (k in element) {
        if (!Element.isReserved(k)) {
          v = element[k];
          copy[k] = serialize(v);
        }
      }
      return copy;
    }
  }
  return element;
}

export namespace Element {
  export enum KeyMeaning {
    User = 0,
    Private,
    Namespace,
    Element,
  };
  export type Query = {
    groups: string[][],
    requiredTags: string[], rejectedTags: string[],
    explicitAttributes?: Set<string>, removedAttributes?: Set<string>,
    method?: string,
  };
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
  export function DynGroupElement<C extends { new(...args): Element }>(parentClass: C) : ({
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

      __resolveWithPath(reporter: Reporter, attrPath: AttributePath) {
        super.__resolveWithPath(reporter, attrPath);
        var elements = <any[]>[];
        var type: string | undefined = undefined;
        var is: string | undefined = undefined;
        var loop = (el) => {
          if (!(el instanceof Element)) {
            attrPath.diagnostic(reporter, {
              type: 'error',
              msg:  `expecting an element, got ${typeof el}`
            });
            return;
          }

          var cis = el.is;
          if (cis === 'group') {
            (el as GroupElementImpl).__resolve(reporter);
            var subs = (el as GroupElementImpl).elements;
            attrPath.push('.elements[', '', ']');
            for (var j = 0, jlen = subs.length; j < jlen; ++j) {
              attrPath.setArrayKey(j);
              loop(subs[j]);
            }
            attrPath.pop(3);
            return;
          }
          if (type === undefined)
            type = typeof el;

          if (typeof el !== type) {
            attrPath.diagnostic(reporter, {
              type: 'error',
              msg:  `elements must be of the same type, expecting ${type}, got ${typeof el}`
            });
          }
          else {
            if (is === undefined)
              is = cis;

            if (is !== cis) {
              attrPath.diagnostic(reporter, {
                type: 'error',
                msg:  `elements must be of the same type, expecting ${is}, got ${cis}`
              });
            }
            else {
              elements.push(el);
            }
          }
        };
        attrPath.push('.elements[', '', ']');
        for (var i = 0, len = this.elements.length; i < len; i++) {
          attrPath.setArrayKey(i);
          loop(this.elements[i]);
        }
        attrPath.pop(3);
        this.elements = elements;
      }
    };
    Element.registerAttributes(GroupElementImpl, [], {
      elements: AttributeTypes.listValidator(Element.validateElement)
    });
    return GroupElementImpl;
  }
}
