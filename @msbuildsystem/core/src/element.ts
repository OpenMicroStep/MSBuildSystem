import {Reporter, AttributePath, Project, ComponentElement, GroupElement, util,
  MakeJS, BuildTargetElement, TargetElement
} from './index.priv';

export type ElementFactory = (reporter: Reporter, name: string,
  definition: MakeJS.Element, attrPath: AttributePath, parent: Element) => Element[];

export const elementValidator = (reporter: Reporter, path: AttributePath, value: any) => {
  if (!(value instanceof Element))
    reporter.diagnostic({ type: "warning", msg: `attribute ${path.toString()} must be an element, got a ${util.limitedDescription(value)}` });
  else
    return value;
  return undefined;
};
export function createElementValidator<T extends Element>(is: string, cls: { new(...args): T }) {
  return function (reporter: Reporter, path: AttributePath, value: any) {
    if ((value = elementValidator(reporter, path, value)) !== undefined && value.is === is && value instanceof cls)
      return <T>value;
    if (value !== undefined)
      reporter.diagnostic({ type: "warning", msg: `attribute ${path.toString()} must be a '${is}' element, got a ${value.is}`});
    return undefined;
  };
}


export var elementFactories = new Map<string, ElementFactory>();
export function declareElementFactory(type: string, factory: ElementFactory) {
    elementFactories.set(type, factory);
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
  [s: string]: any;

  static warningProbableMisuseOfKey = new Set(["tags", "components", "elements", "depth"]);

  constructor(is: string, name: string, parent: Element | null) {
    this.__parent = parent;
    this.__resolved = false;
    this.is = is;
    this.name = name;
  }

  static instantiate(reporter: Reporter, name: string, definition: MakeJS.Element, attrPath: AttributePath, parent: Element) : Element[] {
    var is = definition.is;
    if (typeof is !== 'string') {
      reporter.diagnostic({ type: 'error', msg: `'${attrPath.toString()}.is' attribute must be a string`});
      return [];
    }

    var factory = elementFactories.get(is);
    if (!factory) {
      reporter.diagnostic({ type: 'error', msg: `'${attrPath.toString()}.is' attribute must be a valid element type`});
      factory = elementFactories.get('element')!;
    }
    var elements = factory(reporter, name, definition, attrPath, parent);
    for (var i = 0, len = elements.length; i < len; i++) {
      elements[i].__load(reporter, definition, attrPath);
    }
    return elements;
  }

  __load(reporter: Reporter, definition: MakeJS.Element, attrPath: AttributePath) {
    attrPath.push("");
    for (var k in definition) {
      var v = definition[k];
      if (k[k.length - 1] === "=") {
        var n = k.substring(0, k.length - 1);
        attrPath.set(n);
        this.__loadNamespace(reporter, n, v, attrPath);
      }
      else if (k in this) {
        attrPath.set("." + k);
        this.__loadReservedValue(reporter, k, v, attrPath);
      }
      else {
        if (Element.warningProbableMisuseOfKey.has(k))
          reporter.diagnostic({
            type: 'note',
            msg:  `'${attrPath.toString()}' could be misused, this key has special meaning for other element types`
          });
        this[k] = v;
      }
    }
    attrPath.pop();
  }

  __resolveValue(reporter: Reporter, el, ret: any[], keepGroups?: boolean) {
    if (el instanceof DelayedElement && !el.__parent) {
      el.__parent = this;
    }
    else if (typeof el === "string") {
      if (el[0] === "=") {
        ret.push(...this.resolveElements(reporter, el.substring(1), keepGroups));
        return;
      }
      else if (el[0] === "\\" && el[1] === "=") {
        el = el.substring(1);
      }
    }
    ret.push(el);
  }

  __resolveValues(reporter: Reporter, values: any[], keepGroups: boolean) : any[] {
    var ret: any[] = [];
    for (var i = 0, len = values.length; i < len; ++i) {
      this.__resolveValue(reporter, values[i], ret, keepGroups);
    }
    return ret;
  }
  __resolveValuesByEnv(reporter: Reporter, valuesByEnv: { [s: string]: any[]}, keepGroups: boolean) : { [s: string]: any[]} {
    var copy: { [s: string]: any[]} = {};
    for (var env in valuesByEnv) {
      var v = valuesByEnv[env];
      if (Array.isArray(v)) {
        copy[env] = Array.isArray(v) ? this.__resolveValues(reporter, v, keepGroups) : v;
      }
    }
    return copy;
  }
  __resolveValueForKey(reporter: Reporter, v, k: string, keepGroups: boolean) {
    if (k[k.length - 1] === "=") {
      if (!(<Element>v).__resolved)
        (<Element>v).__resolve(reporter);
    }
    else if (Array.isArray(v)) {
      this[k] = this.__resolveValues(reporter, v, keepGroups);
    }
    else if (k.endsWith("ByEnvironment") && typeof v === 'object') {
      this[k] = this.__resolveValuesByEnv(reporter, v, keepGroups);
    }
  }
  __resolve(reporter: Reporter) {
    this.__resolved = true;
    for (var k in this) {
      this.__resolveValueForKey(reporter, this[k], k, false);
    }
  }

  __loadReservedValue(reporter: Reporter, key: string, value, attrPath: AttributePath) {
    if (key === 'name') {
      if (!this.name) {
        if (typeof value === 'string' && value.length > 0)
          this.name = value;
        else
          reporter.diagnostic({ type: 'error', msg: `'${attrPath.toString()}' attribute must be a string`});
      }
      else if (this.name === value) {
        reporter.diagnostic({ type: 'warning', msg: `'${attrPath.toString()}' attribute is already defined by the namespace`});
      }
      else {
        reporter.diagnostic({
          type: 'error',
          msg: `'${attrPath.toString()}' attribute is already defined by the namespace with a different value`
        });
      }
    }
    else if (key !== 'is') {
      reporter.diagnostic({ type: 'error', msg:  `'${attrPath.toString()}' can't be defined, this key is reserved`});
    }
    // 'is' is handled by the instantiate method
  }

  __loadNamespace(reporter: Reporter, name: string, value, attrPath: AttributePath) {
    var els = Element.instantiate(reporter, name, value, attrPath, this);
    if (els.length > 1)
        reporter.diagnostic({
          type: 'warning',
          msg:  `'${attrPath.toString()}' has been expanded to a multiple elements, none will be referencable`
        });
    if (els.length === 1) {
      name += '=';
      if (name in this)
        reporter.diagnostic({
          type: 'error',
          msg: `'${attrPath.toString()}' attribute is in conflict with an element defined with the same name`
        });
      this[name] = els[0];
    }
  }

  __project() : Project {
    return this.__parent!.__project();
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

  __loadElements(reporter: Reporter, elements: (MakeJS.Element|string)[], attrPath: AttributePath
  ) : (ComponentElement|GroupElement|string)[] {
    var list = <any[]>[];
    if (Array.isArray(elements)) {
      attrPath.push("[", "", "]", "");
      for (var i = 0, len = elements.length; i < len; i++) {
        var e = elements[i];
        if (typeof e === 'string') {
          list.push(e); // this will be resolved in a 2nd pass (__resolve)
        }
        else if (typeof e === 'object') {
          attrPath.set(i.toString(), -3);
          attrPath.set("");
          var subs = Element.instantiate(reporter, "", <MakeJS.Element>e, attrPath, this);
          for (var j = 0, jlen = subs.length; j < jlen; ++j) {
            var sub = subs[j];
            if (sub && sub.name) {
              var k = sub.name + "=";
              if (k in this)
                reporter.diagnostic({
                  type: 'error',
                  msg: `'${attrPath.toString()}' attribute is in conflict with an element defined with the same name`
                });
              this[k] = sub;
            }
          }
          list.push(...subs);
        }
      }
      attrPath.pop(4);
    }
    else {
      reporter.diagnostic({ type: 'error', msg: `'${attrPath.toString()}' attribute must be an array of elements`});
    }
    return list;
  }

  __resolveElements<T extends Element>(reporter: Reporter, elements: any[], path: string, is: string) {
    var components = <T[]>[];
    for (var i = 0, len = elements.length; i < len; i++) {
      var cmp = elements[i];
      if (cmp instanceof Element) {
        if (cmp.is !== is) {
          reporter.diagnostic({
            type: 'error',
            msg:  `'${this.__path()}.${path}' must only contain elements of type '${is}', got {is: '${cmp.is}', name: '${cmp.name}'}'`
          });
        }
        else {
          components.push(<T>cmp);
        }
      }
      else {
        reporter.diagnostic({
          type: 'error',
          msg:  `'${this.__path()}.${path}' must only contain elements of type '${is}', got ${JSON.stringify(cmp)}`
        });
      }
    }
    return components;
  }

  resolveElements(reporter: Reporter, query: string, keepGroups = false) : Element[] {
    let ret: Element[] = [];
    let sides = query.split("?");
    let groups = sides[0].split("+");
    let tags = (sides[1] || "").split("+").map(t => t.trim().replace(/^!\s+/, "!"));
    tags = tags.filter((t, i) => {
      var ok =  t.length > (t[0] === '!' ? 1 : 0);
      if (!ok && tags.length > 1)
        reporter.diagnostic({
          type: "warning",
          msg: `query '${query}' is invalid, one the tags is an empty string, the tag '${t}' is ignored`
        });
      return ok;
    });
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
          && (
            (steps[3].length === 0 && steps[4].length === 0 )
            ||
            (steps.length >= 6 && steps[4].length === 0 && steps[5].length === 0)
          )) { // ::[env:]target::
            ret.push(new DelayedQuery(steps, tags, this));
            delayed = true;
            el = null;
            break;
          }
          else {
            if (steps.length > 1)
              reporter.diagnostic({
                type: "warning",
                msg: `query '${query}' is invalid, one the groups is an empty string, the group '${group}' is ignored`
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
        if (el.is === 'group' && !keepGroups) {
          let els = el.is === 'group' ? (<GroupElement>el).elements || [] : [el];
          for (let e of <({tags: string[]} & Element)[]><any[]>els) {
            let ok = ((e.tags && e.tags.length) || 0) >= tags.length;
            for (let i = 0, len = tags.length; ok && i < len; ++i) {
              let tag = tags[i];
              ok = (e.tags.indexOf(tag) !== -1) === (tag[0] !== '!');
            }
            if (ok)
              ret.push(e);
          }
        }
        else {
          ret.push(el);
        }
      }
      else if (!delayed) {
        reporter.diagnostic({
          type: "warning",
          msg: `query '${query}' refer to a group that can't be found, the group '${group}' is ignored`
        });
      }
    }
    return ret;
  }
}

export class DelayedElement extends Element {
  constructor(parent: Element | null) {
    super('delayed', 'delayed', parent);
  }
  __delayedResolve(reporter: Reporter, buildTarget: BuildTargetElement) : Element[] {
    throw "must be implemented by subclasses";
  }
}

export class DelayedQuery extends DelayedElement {
  constructor(public steps: string[], public tags: string[], parent: Element | null) {
    super(parent);
  }
  __delayedResolve(reporter: Reporter, buildTarget: BuildTargetElement) : Element[] {
    let env = this.steps[3].length > 0 ? this.steps[2] : null;
    let target = this.steps[env ? 3 : 2];
    const size = env ? 6 : 5;
    let project = this.__parent!.__project();
    let workspace = project.workspace;
    let targets = <TargetElement[]>[];
    let elements = <Element[]>[];
    workspace.projects.forEach((p) => {
      targets.push(...p.targets.filter(t => t.name === target));
    });
    if (targets.length === 0) {
      reporter.diagnostic({
        type: "error",
        msg: `query '${this.steps.join(':')}?${this.tags.join('+')}' is invalid, the target '${target}' is not present in the workspace`
      });
    }
    else if (targets.length > 1) {
      // TODO: do this check after project loaded
      reporter.diagnostic({
        type: "error",
        msg: `the target '${target}' is present multiple times in the workspace, this shouldn't happen`
      });
    }
    else {
      let targetElement: TargetElement = targets[0];
      let envStr = env ? { name: env, compatibleEnvironments: [] } : buildTarget.environment;
      let envElement = targetElement.__compatibleEnvironment(reporter, envStr);
      if (envElement) {
        if (this.steps.length > size || this.tags.length > 0) {
          // we must now resolve exported components
          let p = `${this.steps.slice(size).join(':')}?${this.tags.join('+')}`;
          elements = targetElement.__resolveExports(reporter, envElement).resolveElements(reporter, p);
          buildTarget.resolveElementsForEnvironment(reporter, elements, envElement);
        }
        else {
          elements = [buildTarget.buildTargetElement(reporter, targetElement, envElement)];
        }
      }
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
      return (reporter, buildTarget) => { return target.__delayedResolve(reporter, buildTarget); };
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
