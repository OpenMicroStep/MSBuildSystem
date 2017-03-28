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
  definition: ElementDefinition, attrPath: AttributePath, parent: Element) => Element;
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
      return name !== undefined ? [factory(reporter, name, definition, attrPath, parent)] : [];
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

export class Element {
  __parent: Element | null;
  protected __resolved: boolean;
  is: string;
  name: string;
  tags: string[];

  static createElementFactoriesProviderMap = createElementFactoriesProviderMap;

  static isNamespace(value: string) : boolean { return typeof value === 'string' && value.endsWith('='); }
  static name2namespace(name: string) { return name + '='; }
  static namespace2name(namespace: string) { return namespace.substring(0, namespace.length - 1); }

  static isReference(value: string) : boolean { return typeof value === 'string' && value.startsWith('='); }
  static reference2query(name: string) { return name.substring(1); }
  static isReserved(value: string) : boolean {
    return typeof value === 'string' && value.startsWith('__');
  }

  constructor(is: string, name: string, parent: Element | null, tags: string[] = []) {
    this.__parent = parent;
    this.__resolved = false;
    this.is = is;
    this.name = name;
    this.tags = tags;
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
      else if (k in this) {
        // reserved property
        if (k !== 'is' && k !== 'name') {
          attrPath.rewrite('.', k);
          this.__loadReservedValue(context, k, v, attrPath);
        }
      }
      else {
        // simple property
        attrPath.rewrite('.', k);
        if (context.elementFactoriesProviderMap.warningProbableMisuseOfKey.has(k)) {
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
  __loadIfObject<T>(context: ElementLoadContext, object: {[s: string]: any}, into: {[s: string]: T}, attrPath: AttributePath, validator: AttributeTypes.Validator<T, Element>) {
    if (AttributeTypes.validateObject(context.reporter, attrPath, object) !== undefined)
      this.__loadObject(context, object, into, attrPath, validator);
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
      into[k] = validator ? validator(context.reporter, attrPath, v, this) : v;
    }
    attrPath.pop(2);
    return into;
  }
  __loadIfArray<T>(context: ElementLoadContext, values: any[], into: T[], attrPath: AttributePath, validator: AttributeTypes.Validator<T, Element>) {
    if (AttributeTypes.validateArray(context.reporter, attrPath, values) !== undefined)
      this.__loadArray(context, values, into, attrPath, validator);
  }
  __loadArray<T>(context: ElementLoadContext, values: any[], into: T[], attrPath: AttributePath, validator?: AttributeTypes.Validator<T, Element>) {
    attrPath.push('[', '', ']');
    for (var i = 0, len = values.length; i < len; ++i) {
      var v = values[i];
      if (typeof v === "object") {
        attrPath.set(i, -2);
        if (Array.isArray(v))
          this.__push(context.reporter, into, attrPath, validator, this.__loadArray(context, v, <any[]>[], attrPath));
        else
          this.__loadObjectInArray(context, v, into, attrPath.set(i, -2));
      }
      else {
        this.__push(context.reporter, into, attrPath, validator, v);
      }
    }
    attrPath.pop(3);
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
  __loadReservedValue(context: ElementLoadContext, key: string, value, attrPath: AttributePath) {
    if (value === undefined) {
      attrPath.diagnostic(context.reporter, { type: "warning", msg: "value can't be 'undefined'" });
      return;
    }

    let current = this[key];
    if (typeof current === "object" && current !== null) {
      if (Array.isArray(current)) {
        if (Array.isArray(value))
          this.__loadArray(context, value, current, attrPath);
        else
          attrPath.diagnostic(context.reporter, { type: "warning", msg: "value must be an array" });
      }
      else {
        if (typeof value === "object")
          this.__loadObject(context, value, current, attrPath);
        else
          attrPath.diagnostic(context.reporter, { type: "warning", msg: "value must be an object" });
      }
    }
    else {
      this[key] = this.__loadValue(context, value, attrPath);
    }
  }
  __push<T>(reporter: Reporter, into: T[], attrPath: AttributePath, validator: AttributeTypes.Validator<T, Element> | undefined, value) {
    if (!validator || (value = validator(reporter, attrPath, value, this)) !== undefined)
      into.push(value);
  }
  __pushArray<T>(reporter: Reporter, into: T[], attrPath: AttributePath, validator: AttributeTypes.Validator<T, Element> | undefined, values: any[]) {
    attrPath.push('[', '', ']');
    for (var i = 0, len = values.length; i < len; i++) {
      var value = values[i];
      if (!validator || (value = validator(reporter, attrPath.set(i, -1), value, this)) !== undefined)
        into.push(value);
    }
    attrPath.pop(3);
  }
  // Load definitions
  ///////////////////

  ///////////////////
  // Resolve elements
  __resolve(reporter: Reporter) {
    if (!this.__resolved) {
      this.__resolved = true;
      this.__resolveWithPath(reporter, new AttributePath(this));
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
    attrPath.push('[', '', ']');
    for (var i = 0, len = values.length; i < len; ++i)
      this.__resolveValueInArray(reporter, values[i], ret, attrPath.set(i, -2));
    attrPath.pop(3);
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

  __passTags(tags: Element.Tags) : boolean {
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

  __parseQuery(reporter: Reporter, into: Element[], parser: Parser, attrPath: AttributePath) {
    parser.skip(Parser.isAnySpaceChar);
    let groups = parser.ch !== '?' ? this.__parseGroups(reporter, parser, attrPath) : [];
    let tags = parser.test('?') ? this.__parseTags(reporter, parser, attrPath) : { requiredTags: [], rejectedTags: [] };
    for (let group of groups)
      this.__resolveElementsGroup(reporter, into, group, tags, attrPath);
    parser.skip(Parser.isAnySpaceChar);
    if (!parser.atEnd())
       attrPath.diagnostic(reporter, {
          type: 'error',
          msg:  `syntax error, the query can't be fully parsed`
        });
  }
  __parseGroups(reporter: Reporter, parser: Parser, attrPath: AttributePath) : string[][] {
    let groups: string[][] = [];
    do {
      groups.push(parser.while(ch => ch !== '+' && ch !== '?', 1).split(':').map(g => g.trim()));
    } while (parser.test('+'));
    return groups;
  }
  __parseTags(reporter: Reporter, parser: Parser, attrPath: AttributePath) : Element.Tags {
    let ret: Element.Tags = { requiredTags: [], rejectedTags: [] };
    do {
      if (parser.test('!')) {
        parser.skip(Parser.isAnySpaceChar);
        ret.rejectedTags.push(parser.while(ch => ch !== '+', 1).trim());
      }
      else {
        ret.requiredTags.push(parser.while(ch => ch !== '+', 1).trim());
      }
    } while (parser.test('+'));
    return ret;
  }

  __resolveElementsGroup(reporter: Reporter, into: Element[], steps: string[], tags: Element.Tags, attrPath: AttributePath) {
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
        msg: `query '${Element.rebuildQuery([steps], tags)}' refer to an element that can't be found, the group '${steps.join(':')}' is ignored`,
      });
    }
    else
      el.__resolveElementsGroupIfTags(reporter, into, tags);
  }
  __resolveElementsGroupIfTags(reporter: Reporter, into: Element[], tags: Element.Tags) {
    if (this.__passTags(tags)) {
      this.__resolve(reporter);
      into.push(this);
    }
  }

  __resolveElements(reporter: Reporter, into: Element[], query: string, attrPath: AttributePath | undefined = new AttributePath()) {
    let parser = new Parser(reporter, query);
    this.__parseQuery(reporter, into, parser, attrPath);
  }

  toJSON() {
    return serialize(this);
  }
}

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
  export type Tags = { requiredTags: string[], rejectedTags: string[] };
  export function rebuildQuery(steps: string[][], tags: Element.Tags) {
    let ret = steps.map(s => s.join(':')).join(' + ');
    if (tags.rejectedTags.length || tags.requiredTags.length)
      ret += ' ? ' + tags.requiredTags.concat(tags.rejectedTags.map(t => `!${t}`)).join(' + ');
    return ret;
  }

  export interface GroupElement extends Element {
     elements: Element[];
  };
  export function DynGroupElement<C extends { new(...args): Element }>(parentClass: C) : ({
    new (...args: any[]): GroupElement;
    prototype: GroupElement;
  } & C) {
    return class GroupElement extends parentClass {
      elements: Element[] = [];

      __resolveElementsGroupIfTags(reporter: Reporter, into: Element[], tags: Element.Tags) {
        this.__resolve(reporter);
        for (let el of this.elements)
          el.__resolveElementsGroupIfTags(reporter, into, tags);
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
            (el as GroupElement).__resolve(reporter);
            var subs = (el as GroupElement).elements;
            attrPath.push('.elements[', '', ']');
            for (var j = 0, jlen = subs.length; j < jlen; ++j) {
              attrPath.set(j, -2);
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
          attrPath.set(i, -2);
          loop(this.elements[i]);
        }
        attrPath.pop(3);
        this.elements = elements;
      }
    };
  }

  export function validateElement(reporter: Reporter, path: AttributePath, value: any) {
    if (!(value instanceof Element))
      path.diagnostic(reporter, { type: "warning", msg: `attribute must be an element, got a ${util.limitedDescription(value)}` });
    else
      return value;
    return undefined;
  }
  export function elementIsValidator<T extends Element>(isList: string[]) {
    return function (reporter: Reporter, path: AttributePath, cmp: any) {
      cmp = validateElement(reporter, path, cmp);
      if (cmp !== undefined && isList.indexOf(cmp.is) === -1) {
        path.diagnostic(reporter, {
          type: 'error',
          msg:  `only elements of type ${JSON.stringify(isList)} are accepted, got ${JSON.stringify({is: cmp.is, name: cmp.name})}`
        });
        cmp = undefined;
      }
      return cmp;
    };
  }
  export function elementValidator<T extends Element>(is: string, cls: { new(...args): T }) {
    return function (reporter: Reporter, path: AttributePath, value: any) {
      if ((value = validateElement(reporter, path, value)) !== undefined && value.is === is && value instanceof cls)
        return <T>value;
      if (value !== undefined)
        path.diagnostic(reporter, { type: "warning", msg: `attribute must be a '${is}' element, got a ${value.is}`});
      return undefined;
    };
  }
}
