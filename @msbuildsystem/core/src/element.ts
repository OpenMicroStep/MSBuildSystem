import {Reporter, AttributePath, AttributeTypes, GroupElement, util,
  MakeJS, DelayedTarget, TargetElement, Diagnostic, transformWithCategory
} from './index.priv';

export type ElementFactory = (reporter: Reporter, name: string | undefined,
  definition: MakeJS.Element, attrPath: AttributePath, parent: Element, allowNoName: boolean) => Element[];
export type SimpleElementFactory = (reporter: Reporter, name: string,
  definition: MakeJS.Element, attrPath: AttributePath, parent: Element) => Element;

export var globalElementFactories = new Map<string, ElementFactory>();
export function declareElementFactory(type: string, factory: ElementFactory, elementFactories: Map<string, ElementFactory> = globalElementFactories) {
  elementFactories.set(type, factory);
}

export function declareSimpleElementFactory(type: string, factory: SimpleElementFactory, elementFactories: Map<string, ElementFactory> = globalElementFactories) {
  elementFactories.set(type, function simpleElementFactory(
    reporter: Reporter, name: string | undefined,
    definition: MakeJS.Element, attrPath: AttributePath, parent: Element, allowNoName
  ) : Element[] {
    name = handleSimpleElementName(reporter, name, definition.name, attrPath, allowNoName);
    return name !== undefined ? [factory(reporter, name, definition, attrPath, parent)] : [];
  });
}

export function handleSimpleElementName(reporter: Reporter, namespaceName: string | undefined, definitionName: string | undefined, attrPath: AttributePath, allowNoName: boolean) {
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

declareElementFactory('element', (reporter: Reporter, name: string,
  definition: MakeJS.Element, attrPath: AttributePath, parent: Element) => {
  return [new Element('element', name, parent)];
});
export class Element {
  __parent: Element | null;
  __resolved: boolean;
  is: string;
  name: string;
  tags: string[];
  [s: string]: any;

  static warningProbableMisuseOfKey = new Set(["tags", "components", "elements", "depth", "exports"]);
  private static loadWarningProbableMisuseOfKey: Set<string>;
  private static loadElementFactories: Map<string, ElementFactory>;

  constructor(is: string, name: string, parent: Element | null, tags: string[] = []) {
    this.__parent = parent;
    this.__resolved = false;
    this.is = is;
    this.name = name;
    this.tags = tags;
  }

  static load<T extends Element>(reporter: Reporter, definition: MakeJS.Element, root: T, options: {
    warningProbableMisuseOfKey: string[],
    elementFactories: Map<string, ElementFactory> | string[],
  }) {
    if (Array.isArray(options.elementFactories))
      Element.loadElementFactories = new Map(options.elementFactories.map<[string, ElementFactory]>(k => [k, globalElementFactories.get(k)!]));
    else
      Element.loadElementFactories = options.elementFactories;
    Element.loadWarningProbableMisuseOfKey = new Set(Element.warningProbableMisuseOfKey);
    options.warningProbableMisuseOfKey.forEach(k => Element.loadWarningProbableMisuseOfKey.add(k));

    reporter.transform.push(transformWithCategory('load'));
    root.__load(reporter, definition, new AttributePath(root));
    reporter.transform.pop();
    reporter.transform.push(transformWithCategory('resolve'));
    root.__resolve(reporter);
    reporter.transform.pop();

    Element.loadElementFactories = new Map();
    Element.loadWarningProbableMisuseOfKey = Element.warningProbableMisuseOfKey;

    return root;
  }

  static instantiate(reporter: Reporter, name: string | undefined, definition: MakeJS.Element, attrPath: AttributePath, parent: Element, allowNoName = false) : Element[] {
    var is = definition.is;
    var error: string | undefined;
    if (typeof is !== 'string')
      error = `'is' attribute must be a string`;
    else {
      var factory = Element.loadElementFactories.get(is);
      if (!factory)
        error = `'is' attribute must be a valid element type`;
      else {
        attrPath = name ? new AttributePath(parent, ':', name) : attrPath;
        var elements = factory(reporter, name, definition, attrPath, parent, allowNoName);
        for (var element of elements)
          element.__load(reporter, definition, !name && element.name ? new AttributePath(element) : attrPath);
        return elements;
      }
    }
    attrPath.diagnostic(reporter, { type: "error", msg: error }, '.is');
    return [];
  }

  ///////////////////
  // Load definitions
  __load(reporter: Reporter, definition: MakeJS.Element, attrPath: AttributePath) {
    attrPath.push('', '');
    for (var k in definition) {
      var v = definition[k];
      if (k[k.length - 1] === "=") {
        // namespace definition
        var n = k.substring(0, k.length - 1);
        attrPath.rewrite(':', n);
        this.__loadNamespace(reporter, n, v, attrPath);
      }
      else if (k in this) {
        // reserved property
        if (k !== 'is' && k !== 'name') {
          attrPath.rewrite('.', k);
          this.__loadReservedValue(reporter, k, v, attrPath);
        }
      }
      else {
        // simple property
        attrPath.rewrite('.', k);
        if (Element.loadWarningProbableMisuseOfKey.has(k)) {
          attrPath.diagnostic(reporter, { type: 'note', msg: `'${k}' could be misused, this key has special meaning for other element types` });
        }
        this[k] = this.__loadValue(reporter, v, attrPath);
      }
    }
    attrPath.pop(2);
  }

  __loadValue(reporter: Reporter, value: any, attrPath: AttributePath) {
    if (typeof value === "object") {
      if (Array.isArray(value))
        return this.__loadArray(reporter, value, [], attrPath);
      return this.__loadObject(reporter, value, {}, attrPath);
    }
    return value;
  }
  __loadIfObject(reporter: Reporter, object: {[s: string]: any}, into: {[s: string]: any}, attrPath: AttributePath) {
    if (AttributeTypes.validateObject(reporter, attrPath, object) !== undefined)
      this.__loadObject(reporter, object, into, attrPath);
  }
  __loadObject(reporter: Reporter, object: {[s: string]: any}, into: {[s: string]: any}, attrPath: AttributePath) {
    attrPath.push('.', '');
    for (var k in object) {
      var v = object[k];
      attrPath.set(k);
      if (Element.loadWarningProbableMisuseOfKey.has(k)) {
        attrPath.diagnostic(reporter, { type: 'note', msg: `'${k}' could be misused, this key has special meaning for some elements` });
      }
      into[k] = v;
    }
    attrPath.pop(2);
    return into;
  }
  __loadIfArray(reporter: Reporter, values: any[], into: any[], attrPath: AttributePath) {
    if (AttributeTypes.validateArray(reporter, attrPath, values) !== undefined)
      this.__loadArray(reporter, values, into, attrPath);
  }
  __loadArray(reporter: Reporter, values: any[], into: any[], attrPath: AttributePath) {
    attrPath.push('[', '', ']');
    for (var i = 0, len = values.length; i < len; ++i) {
      var v = values[i];
      if (typeof v === "object") {
        if (Array.isArray(v))
          into.push(this.__loadArray(reporter, v, [], attrPath.set(i, -2)));
        else
          this.__loadObjectInArray(reporter, v, into, attrPath.set(i, -2));
      }
      else {
        into.push(v);
      }
    }
    attrPath.pop(3);
    return into;
  }
  __loadObjectInArray(reporter: Reporter, object: {[s: string]: any}, into: any[], attrPath: AttributePath) {
    if ("is" in object) {
      var subs = Element.instantiate(reporter, undefined, <MakeJS.Element>object, attrPath, this, true);
      for (var j = 0, jlen = subs.length; j < jlen; ++j) {
        var sub = subs[j];
        if (sub && sub.name) {
          var k = sub.name + "=";
          if (k in this)
            attrPath.diagnostic(reporter, { type: 'error', msg: `conflict with an element defined with the same name: '${sub.name}'` });
          this[k] = sub;
        }
      }
      into.push(...subs);
    }
    else {
      into.push(this.__loadObject(reporter, object, {}, attrPath));
    }
  }
  __loadNamespace(reporter: Reporter, name: string, value: MakeJS.Element, attrPath: AttributePath) {
    var els = Element.instantiate(reporter, name, value, attrPath, this);
    if (els.length > 1)
      attrPath.diagnostic(reporter, { type: 'warning', msg: `element has been expanded to a multiple elements and can't be referenced` });
    if (els.length === 1) {
      name += '=';
      if (name in this)
        attrPath.diagnostic(reporter, { type: 'error', msg:  `conflict with an element defined with the same name: '${name.substring(0, name.length - 1)}'` });
      this[name] = els[0];
    }
  }
  __loadReservedValue(reporter: Reporter, key: string, value, attrPath: AttributePath) {
    if (key === 'tags') {
      this.tags = AttributeTypes.validateStringList(reporter, new AttributePath(this, '.', key), value);
    }
    else {
      attrPath.diagnostic(reporter, { type: 'error', msg: `'${key}' can't be defined, this key is reserved` });
      // 'is' is handled by the instantiate method
    }
  }
  // Load definitions
  ///////////////////

  ///////////////////
  // Resolve elements
  __resolve(reporter: Reporter) {
    this.__resolved = true;
    this.__resolveValuesInObject(reporter, this, this, false, new AttributePath(this));
  }
  __resolveValueForKey(reporter: Reporter, v, k: string, keepGroups: boolean, attrPath: AttributePath) {
    if (k[k.length - 1] === "=") {
      if (!(<Element>v).__resolved)
        (<Element>v).__resolve(reporter);
    }
    else if (Array.isArray(v)) {
      this[k] = this.__resolveValuesInArray(reporter, v, keepGroups, attrPath);
    }
    else if (typeof v === 'object') {
      this[k] = this.__resolveValuesInObject(reporter, v, {}, keepGroups, attrPath);
    }
  }
  __resolveValuesInObject(reporter: Reporter, object: { [s: string]: any}, into: { [s: string]: any}, keepGroups: boolean, attrPath: AttributePath) : { [s: string]: any[]} {
    attrPath.push('.', '');
    for (var key in object) { if (key[0] === '_' && key[1] === '_') continue;
      var v = object[key];
      into[key] = this.__resolveAnyValue(reporter, v, keepGroups, attrPath.set(key));
    }
    attrPath.pop(2);
    return into;
  }
  __resolveAnyValue(reporter: Reporter, value, keepGroups: boolean, attrPath: AttributePath) {
    if (typeof value === "object") {
      if (Array.isArray(value))
        return this.__resolveValuesInArray(reporter, value, keepGroups, attrPath);
      if (value instanceof Element) {
        if (!value.__resolved)
          value.__resolve(reporter);
        return value;
      }
      return this.__resolveValuesInObject(reporter, value, {}, keepGroups, attrPath);
    }
    return value;
  }
  __resolveValuesInArray(reporter: Reporter, values: any[], keepGroups: boolean, attrPath: AttributePath) : any[] {
    var ret: any[] = [];
    attrPath.push('[', '', ']');
    for (var i = 0, len = values.length; i < len; ++i)
      this.__resolveValueInArray(reporter, values[i], ret, keepGroups, attrPath.set(i, -2));
    attrPath.pop(3);
    return ret;
  }
  __resolveValueInArray(reporter: Reporter, el, ret: any[], keepGroups: boolean, attrPath: AttributePath) {
    if (typeof el === "string") {
      if (el[0] === "=") {
        ret.push(...this.__resolveElementsPriv(reporter, el.substring(1), keepGroups, attrPath));
        return;
      }
      else if (el[0] === "\\" && el[1] === "=") {
        el = el.substring(1);
      }
    }
    else if (typeof el === "object" && typeof el.value === "object" && Array.isArray(el.value)) {
      // resolve complex values
      attrPath.push('.value');
      el.value = this.__resolveValuesInArray(reporter, el.value, keepGroups, attrPath);
      attrPath.pop();
    }
    ret.push(el);
  }
  // Resolve elements
  ///////////////////

  __validateElements<T extends Element>(reporter: Reporter, elements: any[], path: string, isList: string[]) {
    var components = <T[]>[];
    for (var i = 0, len = elements.length; i < len; i++) {
      var cmp = elements[i];
      var ok = cmp instanceof Element;
      if (ok && !(ok = isList.indexOf(cmp.is) !== -1))
        cmp = {is: cmp.is, name: cmp.name};
      if (ok)
        components.push(<T>cmp);
      else {
        reporter.diagnostic({
          type: 'error',
          msg:  `only elements of type ${JSON.stringify(isList)} are accepted, got ${JSON.stringify(cmp)}`,
          path: `'${this.__path()}.${path}[${i}]`
        });
      }
    }
    return components;
  }

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
    return this.__resolveElementsPriv(reporter, query, false, undefined);
  }

  __resolveElementsSteps(reporter: Reporter, steps: string[], groups: string[], ret: Element[]) : boolean {
    return false;
  }

  __resolveElementsPriv(reporter: Reporter, query: string, keepGroups: boolean | undefined, attrPath: AttributePath | undefined) : Element[] {
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
      let el: Element | null = this;
      let steps = group.split(':').map(s => s.trim());
      if (!this.__resolveElementsSteps(reporter, steps, groups, ret)) {
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

        if (el) {
          if (!el.__resolved)
            el.__resolve(reporter);
          if (!keepGroups) {
            let els = el.is === 'group' ? (<GroupElement>el).elements || [] : [el];
            let requiredTagsLen = requiredTags.length;
            let rejectedTagsLen = rejectedTags.length;
            let e: {tags: string[]} & Element, i: number;
            for (e of <any[]>els) {
              let ok = ((e.tags && e.tags.length) || 0) >= requiredTagsLen;
              for (i = 0; ok && i < requiredTagsLen; ++i)
                ok = e.tags.indexOf(requiredTags[i]) !== -1;
              for (i = 0; ok && i < rejectedTagsLen; ++i)
                ok = e.tags.indexOf(rejectedTags[i]) === -1;
              if (ok) {
                ret.push(e instanceof TargetElement ? new DelayedTarget(e, this) : e);
              }
            }
          }
          else {
            ret.push(el);
          }
        }
        else {
          reportDiagnostic(reporter, attrPath, {
            type: "warning",
            msg: `query '${query}' refer to a group that can't be found, the group '${group}' is ignored`,
          });
        }
      }
    }
    return ret;
  }
}

export namespace Element {
  export function validateElement(reporter: Reporter, path: AttributePath, value: any) {
    if (!(value instanceof Element))
      path.diagnostic(reporter, { type: "warning", msg: `attribute must be an element, got a ${util.limitedDescription(value)}` });
    else
      return value;
    return undefined;
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
export const validateElement = Element.validateElement;
export const elementValidator = Element.elementValidator;

function reportDiagnostic(reporter: Reporter, attrPath: AttributePath | undefined, diagnostic: Diagnostic) {
  if (attrPath)
    diagnostic.path = attrPath.toString();
  reporter.diagnostic(diagnostic);
}
