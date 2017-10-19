import {Element,  AttributePath, injectionMapValue, InjectionContext} from '../index.priv';

export class DelayedElement extends Element {
  constructor(parent: Element | null) {
    super('delayed', 'delayed', parent);
  }
  __delayedResolve(ctx: InjectionContext, attrPath: AttributePath) : Element[] {
    throw "must be implemented by subclasses";
  }
}

export class DelayedQuery extends DelayedElement {
  constructor(public gsteps: string[], public steps: string[], public tagsQuery: Element.Query, parent: Element | null) {
    super(parent);
  }
  __delayedResolve(ctx: InjectionContext, at: AttributePath) : Element[] {
    let ret: Element[] = [];
    let sources = ctx.buildTarget.___root.resolveExports(ctx.reporter, at, ctx.buildTarget, this.gsteps);
    if (sources.length === 0) {
      at.diagnostic(ctx.reporter, {
        is: "error",
        msg: `query '${this.__path()}' is invalid, the external element wasn't found`
      });
    }
    for (let group of sources)
      group.__resolveElementsGroup(ctx.reporter, ret, this.steps, this.tagsQuery, at);
    return ret;
  }
  __path() {
    return `::${this.gsteps.join(':')}::${Element.rebuildQuery({ ...this.tagsQuery, groups: [this.steps]})}`;
  }
}

export class DelayedInjection extends DelayedElement {
  constructor(public query: Element.Query, parent: Element) {
    super(parent);
  }
  __delayedResolve(ctx: InjectionContext, at: AttributePath) : Element[] {
    let c = { ...ctx };
    if (this.query.explicitAttributes) {
      let explicitAttributes = this.query.explicitAttributes;
      c.keep = (c, k) => ctx.keep(c, k) && explicitAttributes.has(k);
    }
    else if (this.query.removedAttributes) {
      let removedAttributes = this.query.removedAttributes;
      c.keep = (c, k) => ctx.keep(c, k) && !removedAttributes.has(k);
    }
    let ret = injectionMapValue(c, this.__parent!);
    return [ret];
  }
  __path() {
    return `${Element.rebuildQuery(this.query)}`;
  }
}

type DelayedProxyOp = (ctx: InjectionContext, parent: Element, map: (value) => any) => any;
interface DelayedProxy extends DelayedElement {
  __chain: DelayedProxy | null;
  __delayedResolveOp: DelayedProxyOp;
}

function createDelayedProxy(chain: DelayedProxy | null) {
  let ret = <(() => void) & DelayedProxy>function DelayedProxy() {};
  ret.__parent = null;
  ret.__chain = chain;
  ret.__delayedResolve = function(this: DelayedProxy, ctx: InjectionContext) : Element[]
  {
    return this.__delayedResolveOp(ctx, ret.__parent!, v => v);
  };
  return ret;
}

const delayedQueryOp = function(this: DelayedProxy & { query: string },
  ctx: InjectionContext, parent: Element, map: (value) => any
) {
  return parent.resolveElements(ctx.reporter, this.query).map(map);
};
function createDelayedQueryProxy(chain: DelayedProxy | null, query: string) {
  let ret = <(() => void) & DelayedProxy & { query: string }>createDelayedProxy(chain);
  ret.__delayedResolveOp = delayedQueryOp;
  ret.query = query;
  return ret;
}

const delayedGetOp = function(this: DelayedProxy & { property: string },
  ctx: InjectionContext, parent: Element, map: (value) => any
) {
  return this.__chain!.__delayedResolveOp(ctx, parent, (v) => {
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
  ctx: InjectionContext, parent: Element, map: (value) => any
) {
  if (this.__chain!.__delayedResolveOp === delayedGetOp && this.self === this.__chain!.__chain) {
    let get = <DelayedProxy & { property: string }> this.__chain;
    return get.__chain!.__delayedResolveOp(ctx, parent, (v) => {
      return map(v[get.property].apply(v, this.args));
    });
  }
  return this.__chain!.__delayedResolveOp(ctx, parent, (v) => {
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
  get: function(target: DelayedProxy, property: string) {
    if (property === '__delayedResolve')
      return (ctx, attrPath) => { return target.__delayedResolve(ctx, attrPath); };
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
