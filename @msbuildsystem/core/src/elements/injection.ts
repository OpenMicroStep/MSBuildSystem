import {
  Element, ComponentElement, BuildTargetElement,
  Reporter, AttributePath,
} from '../index.priv';

export interface InjectionContext {
  reporter: Reporter;
  buildTarget: BuildTargetElement;
  deep: boolean;
  map: Map<ComponentElement, ComponentElement>;
}

const notInjectableKeys = /(^__)|([^\\]=$)|is|name|tags|components|environments/;
const copiableAsIsKeys = /(^__)|([^\\]=$)|is|name|tags/;

function injectAttribute(ctx: InjectionContext,
  src: object, srcAttribute: string, srcPath: AttributePath,
  dst: object, dstAttribute: string, dstPath: AttributePath,
  path: string, collisions: Set<string>
) {
  let srcValue = src[srcAttribute];
  let byenv = dstAttribute.endsWith("ByEnvironment");
  if (byenv) {
    dstAttribute = dstAttribute.substring(0, dstAttribute.length - "ByEnvironment".length);
    dstPath.set(dstAttribute);
  }
  path = `${path}[${dstAttribute}]`;
  let dstExists = dstAttribute in dst;
  let dstValue = dstExists ? dst[dstAttribute] : undefined;
  if (!dstExists && collisions.has(path)) { // optim: collision can only occurs if !dstExists
    collision();
  }
  else if (byenv) {
    if (typeof srcValue !== "object") {
      srcPath.diagnostic(ctx.reporter, { type: "warning",
        msg: `not an object: byEnvironment attribute must be an object (ie: { "=env": [values] }), ignoring` });
    }
    else {
      srcPath.pushArray();
      for (let envQuery in srcValue) {
        let matchingEnvs = ctx.buildTarget.resolveElements(ctx.reporter, envQuery);
        if (matchingEnvs.indexOf(ctx.buildTarget.environment) !== -1) {
          srcPath.setArrayKey(envQuery);
          setDstValue(srcValue[envQuery]);
        }
      }
      srcPath.popArray();
    }
  }
  else {
    setDstValue(srcValue);
  }

  function collision() {
    srcPath.diagnostic(ctx.reporter, {type: "warning",
      msg: `collision on ${dstPath}: attribute is removed` });
    delete dst[dstAttribute];
    collisions.add(path);
  }

  function mapValue(srcValue) {
    if (ctx.deep && srcValue instanceof ComponentElement) {
      let v = ctx.map.get(srcValue);
      if (!v) {
        v = Object.create(srcValue.constructor.prototype) as ComponentElement;
        for (let k of Object.getOwnPropertyNames(srcValue)) { // copy private properties
          if (copiableAsIsKeys.test(k))
            v[k] = srcValue[k];
        }
        injectElement(ctx, srcValue, new AttributePath(srcValue), v, new AttributePath(srcValue));
        ctx.map.set(srcValue, v);
      }
      srcValue = v;
    }
    return srcValue;
  }

  function setDstValue(srcValue) {
    if (!dstExists) {
      if (srcValue instanceof Set || srcValue instanceof Array)
        dstValue = dst[dstAttribute] = new Set(srcValue);
      else
        dstValue = dst[dstAttribute] = mapValue(srcValue);
      dstExists = true;
    }
    else if (srcValue instanceof Set || srcValue instanceof Array) { // src is a set
      if (dstValue instanceof Array) {
        dstValue = dst[dstAttribute] = new Set(dstValue);
        for (let v of srcValue)
          dstValue.add(mapValue(v));
      }
      else if (dstValue instanceof Set) {
        for (let v of srcValue)
          dstValue.add(mapValue(v));
      }
      else if (srcValue !== dstValue)
        collision();
    }
    else if (srcValue instanceof Object && dstValue instanceof Object && !(dstValue instanceof Set || dstValue instanceof Array)) {
      injectElement(ctx, srcValue, srcPath, dstValue, dstPath, path, collisions);
    }
    else if (srcValue !== dstValue)
      collision();
  }
}

export function injectElement(ctx: InjectionContext,
  src: object, srcPath: AttributePath,
  dst: object, dstPath: AttributePath,
  path: string = '', collisions: Set<string> = new Set()
) {
  srcPath.push('.', '');
  dstPath.push('.', '');
  for (let attribute in src) {
    if (!notInjectableKeys.test(attribute))
      injectAttribute(ctx, src, attribute, srcPath.set(attribute), dst, attribute, dstPath.set(attribute), path, collisions);
  }
  dstPath.pop(2);
  if (ctx.deep && src instanceof ComponentElement) {
    srcPath.set('components');
    injectComponents(src.components);
    srcPath.pushArray();
    for (let envQuery in src.componentsByEnvironment) {
      let matchingEnvs = ctx.buildTarget.resolveElements(ctx.reporter, envQuery);
      if (matchingEnvs.indexOf(ctx.buildTarget.environment) !== -1) {
        srcPath.setArrayKey(envQuery);
        injectComponents(src.componentsByEnvironment[envQuery]);
      }
    }
    srcPath.popArray();
  }
  srcPath.pop(2);

  function injectComponents(components: ComponentElement[]) {
    srcPath.pushArray();
    for (let i = 0; i < components.length; i++) {
      let component = components[i];
      srcPath.setArrayKey(i);
      injectElement(ctx,
        component, component.name ? new AttributePath(component) : srcPath,
        dst, dstPath,
        path, collisions);
    }
    srcPath.popArray();
  }
}

export function injectElements(ctx: InjectionContext,
  elements: Element[],
  dst: object, dstPath: AttributePath,
  path: string = '', collisions: Set<string> = new Set()
) {
  for (let element of elements)
    injectElement(ctx, element, new AttributePath(element), dst, dstPath, path, collisions);
}

export function createInjectionContext(reporter: Reporter, buildTarget: BuildTargetElement, deep = true) : InjectionContext {
  return {
    reporter: reporter,
    buildTarget: buildTarget,
    deep: deep,
    map: new Map()
  };
}
