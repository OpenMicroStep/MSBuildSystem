import {Reporter, AttributePath, AttributeTypes, Project, ComponentElement, GroupElement, util,
  MakeJS, BuildTargetElement, TargetElement, Diagnostic
} from './index.priv';

export type ElementFactory = (reporter: Reporter, name: string | undefined,
  definition: MakeJS.Element, attrPath: AttributePath, parent: Element, allowNoName: boolean) => Element[];
export type SimpleElementFactory = (reporter: Reporter, name: string,
  definition: MakeJS.Element, attrPath: AttributePath, parent: Element) => Element;

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

export var elementFactories = new Map<string, ElementFactory>();
export function declareElementFactory(type: string, factory: ElementFactory) {
  elementFactories.set(type, factory);
}

export function declareSimpleElementFactory(type: string, factory: SimpleElementFactory) {
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

  constructor(is: string, name: string, parent: Element | null, tags: string[] = []) {
    this.__parent = parent;
    this.__resolved = false;
    this.is = is;
    this.name = name;
    this.tags = tags;
  }

  static instantiate(reporter: Reporter, name: string | undefined, definition: MakeJS.Element, attrPath: AttributePath, parent: Element, allowNoName = false) : Element[] {
    var is = definition.is;
    var error: string | undefined;
    if (typeof is !== 'string')
      error = `'is' attribute must be a string`;
    else {
      var factory = elementFactories.get(is);
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
        if (Element.warningProbableMisuseOfKey.has(k)) {
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
      if (Element.warningProbableMisuseOfKey.has(k)) {
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
    if (el instanceof DelayedElement && !el.__parent) {
      el.__parent = this;
    }
    else if (typeof el === "string") {
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

  __project() : Project {
    return this.__parent!.__project();
  }

  __absoluteFilepath() : string {
    return this.__parent!.__absoluteFilepath();
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
      let delayed = false;
      let el: Element | null = this;
      let steps = group.split(':').map(s => s.trim());
      for (let i = 0, len = steps.length; el && i < len; ++i) {
        let step = steps[i];
        if (step.length === 0) {
          if (i === 0
          && steps.length >= 5
          && steps[1].length === 0
          && steps[2].length > 0
          && ((steps[3].length === 0) || (steps.length >= 6 && steps[4].length === 0))
          ) { // ::[env:]target::
            ret.push(new DelayedQuery(steps, sides[1] || "", this));
            delayed = true;
            el = null;
            break;
          }
          else {
            if (steps.length > 1)
              reportDiagnostic(reporter, attrPath, {
                type: "warning",
                msg: `query '${query}' is invalid, one the groups is an empty string, the group '${group}' is ignored`,
              });
            break;
          }
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
      else if (!delayed) {
        reportDiagnostic(reporter, attrPath, {
          type: "warning",
          msg: `query '${query}' refer to a group that can't be found, the group '${group}' is ignored`,
        });
      }
    }
    return ret;
  }
}

function reportDiagnostic(reporter: Reporter, attrPath: AttributePath | undefined, diagnostic: Diagnostic) {
  if (attrPath)
    diagnostic.path = attrPath.toString();
  reporter.diagnostic(diagnostic);
}

export class DelayedElement extends Element {
  constructor(parent: Element | null) {
    super('delayed', 'delayed', parent);
  }
  __delayedResolve(reporter: Reporter, buildTarget: BuildTargetElement, attrPath: AttributePath) : Element[] {
    throw "must be implemented by subclasses";
  }
}

export class DelayedQuery extends DelayedElement {
  constructor(public steps: string[], public tagsQuery: string, parent: Element | null) {
    super(parent);
  }
  __delayedResolve(reporter: Reporter, buildTarget: BuildTargetElement, attrPath: AttributePath) : Element[] {
    let env = this.steps[3].length > 0 ? this.steps[2] : null;
    let target = this.steps[env ? 3 : 2];
    const size = env ? 5 : 4;
    let project = this.__parent!.__project();
    let workspace = project.workspace;
    let targets = <TargetElement[]>[];
    let elements = <Element[]>[];
    workspace.projects.forEach((p) => {
      targets.push(...p.targets.filter(t => t.name === target));
    });
    if (targets.length === 0) {
      attrPath.diagnostic(reporter, {
        type: "error",
        msg: `query '${this.steps.join(':')}${this.tagsQuery ? "?" + this.tagsQuery : ""}' is invalid, the target '${target}' is not present in the workspace`
      });
    }
    else if (targets.length > 1) {
      // TODO: do this check after project loaded
      attrPath.diagnostic(reporter, {
        type: "error",
        msg: `the target '${target}' is present multiple times in the workspace, this shouldn't happen`
      });
    }
    else {
      let targetElement: TargetElement = targets[0];
      let envStr = env ? { name: env, compatibleEnvironments: [] } : buildTarget.environment;
      let exports = buildTarget.__resolveDelayedExports(reporter, targetElement, envStr);
      if (exports) {
        let p = `${this.steps.slice(size).join(':')}${this.tagsQuery ? "?" + this.tagsQuery : ""}`;
        elements = exports.resolveElements(reporter, p);
      }
    }
    return elements;
  }
}

export class DelayedTarget extends DelayedElement {
  constructor(public target: TargetElement, parent: Element | null) {
    super(parent);
  }
  __delayedResolve(reporter: Reporter, buildTarget: BuildTargetElement, attrPath: AttributePath) : Element[] {
    let elements = <Element[]>[];
    let targetElement: TargetElement = this.target;
    let exports = buildTarget.__resolveDelayedExports(reporter, targetElement, buildTarget.environment);
    if (exports) {
      elements = [exports];
    }
    return elements;
  }
}

type DelayedProxyOp = (reporter: Reporter, buildTarget: BuildTargetElement, parent: Element, map: (value) => any) => any;
interface DelayedProxy extends DelayedElement {
  __chain: DelayedProxy | null;
  __delayedResolveOp: DelayedProxyOp;
}

function createDelayedProxy(chain: DelayedProxy | null) {
  let ret = <(() => void) & DelayedProxy>function DelayedProxy() {};
  ret.__parent = null;
  ret.__chain = chain;
  ret.__delayedResolve = function(this: DelayedProxy, reporter: Reporter, buildTarget: BuildTargetElement) : Element[]
  {
    return this.__delayedResolveOp(reporter, buildTarget, ret.__parent!, v => v);
  };
  return ret;
}

const delayedQueryOp = function(this: DelayedProxy & { query: string },
  reporter: Reporter, buildTarget: BuildTargetElement, parent: Element, map: (value) => any
) {
  return parent.resolveElements(reporter, this.query).map(map);
};
function createDelayedQueryProxy(chain: DelayedProxy | null, query: string) {
  let ret = <(() => void) & DelayedProxy & { query: string }>createDelayedProxy(chain);
  ret.__delayedResolveOp = delayedQueryOp;
  ret.query = query;
  return ret;
}

const delayedGetOp = function(this: DelayedProxy & { property: string },
  reporter: Reporter, buildTarget: BuildTargetElement, parent: Element, map: (value) => any
) {
  return this.__chain!.__delayedResolveOp(reporter, buildTarget, parent, (v) => {
    return map(v[this.property]);
  });
};
function createDelayedGetProxy(chain: DelayedProxy, property: string) {
  let ret = <(() => void) & DelayedProxy & { property: string }>createDelayedProxy(chain);
  ret.__delayedResolveOp = delayedGetOp;
  ret.property = property;
  return ret;
}

const delayedApplyOp = function(this: DelayedProxy & { self: any, args: any[] },
  reporter: Reporter, buildTarget: BuildTargetElement, parent: Element, map: (value) => any
) {
  if (this.__chain!.__delayedResolveOp === delayedGetOp && this.self === this.__chain!.__chain) {
    let get = <DelayedProxy & { property: string }> this.__chain;
    return get.__chain!.__delayedResolveOp(reporter, buildTarget, parent, (v) => {
      return map(v[get.property].apply(v, this.args));
    });
  }
  return this.__chain!.__delayedResolveOp(reporter, buildTarget, parent, (v) => {
    return map(v.apply(this.self, this.args));
  });
};
function createDelayedApplyProxy(chain: DelayedProxy, self, args) {
  let ret = <(() => void) & DelayedProxy & { self: any, args: any[] }>createDelayedProxy(chain);
  ret.__delayedResolveOp = delayedApplyOp;
  ret.self = self;
  ret.args = args;
  return ret;
}

const prototypeOfDelayedElement = Object.getPrototypeOf(new DelayedElement(null));
let proxyHandler: ProxyHandler<DelayedElement> = {
  apply: function(target: DelayedProxy, self, args) {
    return new Proxy<DelayedElement>(createDelayedApplyProxy(target, (self && self.__unproxy) || self, args), proxyHandler);
  },
  get: function(target: DelayedProxy, property) {
    if (property === '__delayedResolve')
      return (reporter, buildTarget, attrPath) => { return target.__delayedResolve(reporter, buildTarget, attrPath); };
    if (property === '__unproxy')
      return target;
    return new Proxy<DelayedElement>(createDelayedGetProxy(target, property), proxyHandler);
  },
  getPrototypeOf: function (t) {
    return prototypeOfDelayedElement;
  }
};
export function newProxyElement(query: string) {
  return new Proxy<DelayedElement>(createDelayedQueryProxy(null, query), proxyHandler);
}
