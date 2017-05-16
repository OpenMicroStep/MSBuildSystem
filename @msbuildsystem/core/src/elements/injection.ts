import {
  Element, ComponentElement, BuildTargetElement, DelayedElement,
  Reporter, AttributePath, AttributeTypes, util, Diagnostic,
} from '../index.priv';

export interface InjectionContext {
  reporter: Reporter;
  buildTarget: BuildTargetElement;
  map: Map<ComponentElement, ComponentElement>;
  deep: (ctx: InjectionContext, kind: 'components' | 'value') => boolean;
  keep: (ctx: InjectionContext, attribute: string) => boolean;
  copy: (ctx: InjectionContext, attribute: string) => boolean;
  llvl: number; lpath: string; lcollisions: Map<string, Diagnostic & { notes: Diagnostic[] }>;
  lprevious: Map<string, [string, object][]>;
  uid: number;
}

/*class Tracer {
  path: string;
  previous: [string, object][] = [];
  collision?: Diagnostic & { notes: Diagnostic[] } = undefined;
  subs: Map<string, Tracer>;

}*/

const notInjectableKeys = /(^__)|([^\\]=$)|is|name|tags|components|environment|environments/;
const copiableAsIsKeys = /(^__)|([^\\]=$)|is|name|tags/;

export function injectDefaultDeep(ctx: InjectionContext, kind: 'components' | 'value') {
  return true;
}
export function injectDefaultKeep(ctx: InjectionContext, attribute: string) {
  return !notInjectableKeys.test(attribute);
}
export function injectDefaultCopy(ctx: InjectionContext, attribute: string) {
  return copiableAsIsKeys.test(attribute);
}

function injectAttribute(ctx: InjectionContext,
  src: object, srcAttribute: string, srcPath: AttributePath,
  dst: object, dstAttribute: string, dstPath: AttributePath
) {
  let srcValue = src[srcAttribute];
  let byenv = dstAttribute.endsWith("ByEnvironment");
  if (byenv) {
    dstAttribute = dstAttribute.substring(0, dstAttribute.length - "ByEnvironment".length);
    dstPath.set(dstAttribute);
  }
  if (!ctx.keep(ctx, dstAttribute))
    return;

  let llvl = ctx.llvl;
  let lpath_i = ctx.lpath;
  let lpath = ctx.lpath = `${lpath_i}[${dstAttribute}]`;
  let dstExists = dstAttribute in dst;
  let dstValue = dstExists ? dst[dstAttribute] : undefined;
  if (!dstExists && ctx.lcollisions.has(lpath)) { // optim: collision can only occurs if !dstExists
    collision();
  }
  else if (byenv) {
    if (typeof srcValue !== "object") {
      srcPath.diagnostic(ctx.reporter, { type: "warning",
        msg: `not an object: ByEnvironment attribute must be an object (ie: { "=env": [values] }), ignoring` });
    }
    else if (!(src instanceof Element)) {
      srcPath.diagnostic(ctx.reporter, { type: "warning",
        msg: `not allowed suffix: ByEnvironment attribute outside an element, ignoring` });
    }
    else {
      srcPath.pushArray();
      for (let envQuery in srcValue) {
        let matchingEnvs = src.resolveElements(ctx.reporter, envQuery);
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

  ctx.llvl = llvl;
  ctx.lpath = lpath_i;

  function collision(msg: string = "collision: attribute is removed") {
    let d = ctx.lcollisions.get(lpath);
    if (!d) {
      d = {type: "warning", msg: msg, path: dstPath.toString(), notes: [] };
      let ccollisionpath = srcPath.toString();
      let pcollisionpath: string;
      for (let [plpath, plobj] of (ctx.lprevious.get(lpath_i) || [])) {
        let plattr = dstAttribute;
        if (plattr in plobj && (pcollisionpath = `${plpath}.${plattr}`) !== ccollisionpath)
          d.notes.push({ type: "note", msg: "while merging", path: pcollisionpath });
        plattr += 'ByEnvironment';
        if (plattr in plobj && plobj instanceof Element) {
          let plbyenv = plobj[plattr];
          for (let envQuery in plbyenv) {
            let matchingEnvs = plobj.resolveElements(new Reporter(), envQuery); // ignore diags
            if (matchingEnvs.indexOf(ctx.buildTarget.environment) !== -1) {
              pcollisionpath = `${plpath}.${plattr}[${envQuery}]`;
              if (pcollisionpath === ccollisionpath)
                break; // break here to prevent writing notes too soon (use the js object key ordering property)
              d.notes.push({ type: "note", msg: "while merging", path: pcollisionpath });
            }
          }
        }
      }
      d.notes.push({ type: "note", msg: "caused collision while merging", path: ccollisionpath });
      ctx.lcollisions.set(lpath, d);
    }
    else {
      d.notes.push({ type: "note", msg: "while merging", path: srcPath.toString() });
    }
    delete dst[dstAttribute];
  }

  function mapValues(srcValues: Iterable<any>, dstSet: Set<any>, lvl = 0) : Set<any> {
    if (lvl === 0)
      pushlp(ctx, src, srcPath);
    for (let srcValue of srcValues) {
      if (srcValue instanceof DelayedElement)
        mapValues(srcValue.__delayedResolve(ctx, dstPath), dstSet, lvl + 1);
      else
        dstSet.add(injectionMapValueInIterable(ctx, srcValue, ++ctx.uid)); // create a new unique context
    }
    return dstSet;
  }

  function setDstValue(srcValue) {
    let isValue = Element.isValue(srcValue);
    if (!dstExists) {
      if (isValue) {
        if (srcValue instanceof Array)
          dstValue = dst[dstAttribute] = srcValue.map((v, idx) => injectionMapValueInIterable(ctx, v, idx));
        else
          dstValue = dst[dstAttribute] = srcValue;
      }
      else if (srcValue instanceof Set || srcValue instanceof Array)
        dstValue = dst[dstAttribute] = mapValues(srcValue, new Set());
      else if (srcValue instanceof DelayedElement) {
        let srcValues = srcValue.__delayedResolve(ctx, dstPath);
        if (srcValues.length === 1)
          dstValue = dst[dstAttribute] = injectionMapValue(ctx, srcValues[0]);
        else {
          if (srcValues.length === 0)
            collision(`query '${srcValue.__path()}' returned no element, one was expected: attribute is removed`);
          else
            collision(`query '${srcValue.__path()}' multiple elements, one was expected: attribute is removed`);
        }
      }
      else
        dstValue = dst[dstAttribute] = injectionMapValue(ctx, srcValue);
      dstExists = true;
    }
    else if (isValue && srcValue !== dstValue)
      collision();
    else if (srcValue instanceof Set || srcValue instanceof Array) { // src is a set
      if (dstValue instanceof Array) {
        dstValue = dst[dstAttribute] = new Set(dstValue);
        mapValues(srcValue, dstValue);
      }
      else if (dstValue instanceof Set) {
        mapValues(srcValue, dstValue);
      }
      else if (srcValue !== dstValue)
        collision();
    }
    else if (srcValue instanceof Object && dstValue instanceof Object && !(dstValue instanceof Set || dstValue instanceof Array)) {
      let llvl = ctx.llvl++;
      injectElement(ctx, srcValue, srcPath, dstValue, dstPath);
      ctx.llvl = llvl;
    }
    else if (srcValue !== dstValue)
      collision();
  }
}
function injectionMapValueInIterable(ctx: InjectionContext, srcValue, idx: number) {
  let lpath = ctx.lpath;
  ctx.lpath += idx;
  let ret = injectionMapValue(ctx, srcValue);
  ctx.lpath = lpath;
  return ret;
}

export function injectionMapValue(ctx: InjectionContext, srcValue) {
  if (ctx.deep(ctx, 'value') && srcValue instanceof ComponentElement) {
    let v = ctx.map.get(srcValue);
    if (!v) {
      v = util.clone(srcValue, k => ctx.copy(ctx, k));
      injectElement(ctx, srcValue, new AttributePath(srcValue), v, new AttributePath(srcValue));
      ctx.map.set(srcValue, v);
    }
    srcValue = v;
  }
  return srcValue;
}

function pushlp(ctx: InjectionContext, src: object, srcPath: AttributePath) {
  let lprevious = ctx.lprevious.get(ctx.lpath);
  if (!lprevious)
    ctx.lprevious.set(ctx.lpath, lprevious = []);
  lprevious.push([srcPath.toString(), src]);
}
const validateComponents = AttributeTypes.listValidator(ComponentElement.validate);
export function injectElement(ctx: InjectionContext,
  src: object, srcPath: AttributePath,
  dst: object, dstPath: AttributePath
) {
  pushlp(ctx, src, srcPath);
  srcPath.push('.', '');
  dstPath.push('.', '');
  for (let attribute in src) {
    injectAttribute(ctx, src, attribute, srcPath.set(attribute), dst, attribute, dstPath.set(attribute));
  }
  dstPath.pop(2);
  if (ctx.deep(ctx, 'components') && src instanceof ComponentElement) {
    srcPath.set('components');
    injectComponents(src.components, srcPath);
    srcPath.pushArray();
    for (let envQuery in src.componentsByEnvironment) {
      let matchingEnvs = src.resolveElements(ctx.reporter, envQuery);
      if (matchingEnvs.indexOf(ctx.buildTarget.environment) !== -1) {
        srcPath.setArrayKey(envQuery);
        injectComponents(src.componentsByEnvironment[envQuery], srcPath);
      }
    }
    srcPath.popArray();
  }
  srcPath.pop(2);

  function injectComponents(components: ComponentElement[], srcPath: AttributePath) {
    srcPath.pushArray();
    for (let i = 0; i < components.length; i++) {
      let component = components[i];
      if (component instanceof DelayedElement) {
        let els = component.__delayedResolve(ctx, srcPath);
        let at = new AttributePath(component);
        injectComponents(validateComponents.validate(ctx.reporter, at, els), at);
      }
      else {
        srcPath.setArrayKey(i);
        injectElement(ctx,
          component, component.name ? new AttributePath(component) : srcPath,
          dst, dstPath);
      }
    }
    srcPath.popArray();
  }
}

export function injectElements(ctx: InjectionContext,
  elements: Element[],
  dst: object, dstPath: AttributePath,
  glvl: number = 0, gpath: string = '', llvl: number = 0, lpath: string = '', lcollisions: Set<string> = new Set()
) {
  for (let element of elements)
    injectElement(ctx, element, new AttributePath(element), dst, dstPath);
}

export function createInjectionContext(reporter: Reporter, buildTarget: BuildTargetElement) : InjectionContext {
  return {
    reporter: reporter,
    buildTarget: buildTarget,
    map: new Map(),
    deep: injectDefaultDeep,
    keep: injectDefaultKeep,
    copy: injectDefaultCopy,
    llvl: 0,
    lpath: '',
    lcollisions: new Map(),
    lprevious: new Map(),
    uid: 0,
  };
}

export function closeInjectionContext(ctx: InjectionContext) {
  for (let d of ctx.lcollisions.values())
    ctx.reporter.diagnostic(d);
}
