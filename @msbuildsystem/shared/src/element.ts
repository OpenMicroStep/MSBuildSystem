import {
  Reporter, AttributePath, AttributeTypes,
  util, createProviderMap, ProviderMap,
  Diagnostic, transformWithCategory
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
  else if (namespaceName === definitionName) {
    attrPath.diagnostic(reporter, { type: 'warning', msg: `'name' attribute is already defined by the namespace` });
  }
  else if (typeof definitionName === 'string') {
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
  [s: string]: any;

  static createElementFactoriesProviderMap = createElementFactoriesProviderMap;

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
      if (k[k.length - 1] === "=") {
        // namespace definition
        var n = k.substring(0, k.length - 1);
        attrPath.rewrite(':', n);
        this.__loadNamespace(context, n, v, attrPath);
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
    attrPath.push('.', '');
    for (var k in object) {
      var v = object[k];
      attrPath.set(k);
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
          var k = sub.name + "=";
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
  __loadNamespace(context: ElementLoadContext, name: string, value: ElementDefinition, attrPath: AttributePath) {
    var els = Element.instantiate(context, name, value, attrPath, this);
    if (els.length > 1)
      attrPath.diagnostic(context.reporter, { type: 'warning', msg: `element has been expanded to a multiple elements and can't be referenced` });
    if (els.length === 1) {
      name += '=';
      if (name in this)
        attrPath.diagnostic(context.reporter, { type: 'error', msg:  `conflict with an element defined with the same name: '${name.substring(0, name.length - 1)}'` });
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
      this[key] = value;
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
    if (k[k.length - 1] === "=") {
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
    for (var key in object) { if (key[0] === '_' && key[1] === '_') continue;
      var v = object[key];
      into[key] = this.__resolveAnyValue(reporter, v, attrPath.set(key));
    }
    attrPath.pop(2);
    return into;
  }
  __resolveAnyValue(reporter: Reporter, value, attrPath: AttributePath) {
    if (typeof value === "object") {
      if (Array.isArray(value))
        return this.__resolveValuesInArray(reporter, value, attrPath);
      if (value instanceof Element) {
        value.__resolve(reporter);
        return value;
      }
      return this.__resolveValuesInObject(reporter, value, {}, attrPath);
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
    if (typeof el === "string") {
      if (el[0] === "=") {
        ret.push(...this.__resolveElementsPriv(reporter, el.substring(1), attrPath));
        return;
      }
      else if (el[0] === "\\" && el[1] === "=") {
        el = el.substring(1);
      }
    }
    else if (typeof el === "object" && typeof el.value === "object" && Array.isArray(el.value)) {
      // resolve complex values
      attrPath.push('.value');
      el.value = this.__resolveValuesInArray(reporter, el.value, attrPath);
      attrPath.pop();
    }
    ret.push(el);
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

  resolveElements(reporter: Reporter, query: string) {
    return this.__resolveElementsPriv(reporter, query, undefined);
  }

  __resolveElementsGroup(reporter: Reporter, steps: string[], tagsQuery: string | undefined, ret: Element[]) : Element | undefined | true {
    return undefined;
  }

  __resolveElementsTagsFilter(e: Element, requiredTags: string[], rejectedTags: string[]): boolean {
    let requiredTagsLen = requiredTags.length;
    let rejectedTagsLen = rejectedTags.length;
    let i: number;
    let ok = ((e.tags && e.tags.length) || 0) >= requiredTagsLen;
    for (i = 0; ok && i < requiredTagsLen; ++i)
      ok = e.tags.indexOf(requiredTags[i]) !== -1;
    for (i = 0; ok && i < rejectedTagsLen; ++i)
      ok = e.tags.indexOf(rejectedTags[i]) === -1;
    return ok;
  }

  __resolveElementsTags(reporter: Reporter, el: Element, into: Element[], requiredTags: string[], rejectedTags: string[]) {
    if (this.__resolveElementsTagsFilter(el, requiredTags, rejectedTags))
      into.push(el);
  }

  __resolveElementsPriv(reporter: Reporter, query: string, attrPath: AttributePath | undefined) : Element[] {
    let ret: Element[] = [];
    let sides = query.split("?");
    let groups = sides[0].split("+");
    let requiredTags = <string[]>[];
    let rejectedTags = <string[]>[];
    if (sides[1]) {
      sides[1].split("+").forEach(t => {
        t = t.trim();
        let isNeg = t[0] === '!';
        if (isNeg)
          t = t.replace(/^!\s*/, "");
        if (t.length === 0) {
          reportDiagnostic(reporter, attrPath, {
            type: "warning",
            msg: `query '${query}' is invalid, one the tags is an empty string, the tag '${t}' is ignored`
          });
        }
        else
          (isNeg ? rejectedTags : requiredTags).push(t);
      });
    }
    for (let group of groups) {
      let steps = group.split(':').map(s => s.trim());
      let rel = this.__resolveElementsGroup(reporter, steps, sides[1], ret);
      if (rel !== true) {
        let el = <Element | undefined>rel;
        if (!el) {
          el = this;
          for (let i = 0, len = steps.length; el && i < len; ++i) {
            let step = steps[i];
            if (step.length === 0) {
              if (steps.length > 1)
                reportDiagnostic(reporter, attrPath, {
                  type: "warning",
                  msg: `query '${query}' is invalid, one the groups is an empty string, the group '${group}' is ignored`,
                });
              break;
            }
            let stepeq = step + "=";
            let found = el[stepeq];
            if (i === 0) {
              while (!found && el.__parent) {
                el = el.__parent;
                found = el[stepeq];
              }
            }
            el = found;
          }
        }

        if (el) {
          el.__resolve(reporter);
          this.__resolveElementsTags(reporter, el, ret, requiredTags, rejectedTags);
        }
        else {
          reportDiagnostic(reporter, attrPath, {
            type: "warning",
            msg: `query '${query}' refer to an element that can't be found, the group '${group}' is ignored`,
          });
        }
      }
    }
    return ret;
  }

  toJSON() {
    return serialize(this);
  }
}

function serialize(element: Element) {
  if (typeof element === "object") {
    if (Array.isArray(element)) {
      return element.slice(0).map(e => serialize(e));
    }
    else {
      let k, v, copy = {};
      for (k in element) {
        if (!k.startsWith("__")) {
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

function reportDiagnostic(reporter: Reporter, attrPath: AttributePath | undefined, diagnostic: Diagnostic) {
  if (attrPath)
    diagnostic.path = attrPath.toString();
  reporter.diagnostic(diagnostic);
}
