import {Element, Reporter, AttributePath, ProjectElement, BuildTargetElement, TargetElement} from '../index.priv';

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
    let project = (<ProjectElement>this.__root()).__project();
    let workspace = project.workspace;
    let sources = workspace.resolveExports(target, buildTarget.environment.name, buildTarget.variant);
    let elements = <Element[]>[];
    if (sources.length === 0) {
      attrPath.diagnostic(reporter, {
        type: "error",
        msg: `query '${this.steps.join(':')}${this.tagsQuery ? "?" + this.tagsQuery : ""}' is invalid, the target '${target}' is not present in the workspace`
      });
    }
    else if (sources.length > 1) {
      // TODO: do this check after project loaded
      attrPath.diagnostic(reporter, {
        type: "error",
        msg: `the target '${target}' is present multiple times in the workspace, this shouldn't happen`
      });
    }
    else {
      let source: Element | null = sources[0];
      if (source instanceof TargetElement) {
        let envStr = env ? { name: env, compatibleEnvironments: [] } : buildTarget.environment;
        source = buildTarget.__resolveDelayedExports(reporter, source, envStr);
      }
      if (source) {
        let p = `${this.steps.slice(size).join(':')}${this.tagsQuery ? "?" + this.tagsQuery : ""}`;
        elements = source.resolveElements(reporter, p);
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
  get: function(target: DelayedProxy, property: string) {
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
