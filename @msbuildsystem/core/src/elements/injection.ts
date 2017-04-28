import {
  Element, DelayedElement, ComponentElement, BuildTargetElement,
  Reporter, AttributePath,
} from '../index.priv';

export const notInjectableKeys = /(^__)|([^\\]=$)|tags|elements|environments/;

export function defaultKeyMap(key: string) {
  return notInjectableKeys.test(key) ? '' : key;
}
export function defaultValueMap(at: AttributePath, key: string, v) {
  return v;
}

function injectAttribute(
  reporter: Reporter,
  src: object, srcAttribute: string, srcPath: AttributePath,
  dst: object, dstAttribute: string, dstPath: AttributePath,
  buildTarget: BuildTargetElement,
  mapValue: (at: AttributePath, key: string, value) => any,
  keysWithSimpleValue: Set<string>, globalKeysWithSimpleValue: Set<string>
) {
  let srcValue = src[srcAttribute];
  let byenv = dstAttribute.endsWith("ByEnvironment");
  if (byenv)
    dstAttribute = dstAttribute.substring(0, dstAttribute.length - "ByEnvironment".length);
  let dstExists = dstAttribute in dst;
  let dstValue = dstExists ? dst[dstAttribute] : undefined;
  let dstIsArray = dstValue ? Array.isArray(dstValue) : false;
  if (byenv) {
    if (typeof srcValue !== "object") {
      srcPath.diagnostic(reporter, {
        type: "warning",
        msg: `not an object: byEnvironment attribute must be an object (ie: { "=env": [values] }), ignoring`
      });
    }
    else if (!dstIsArray && dstExists) {
      srcPath.diagnostic(reporter, {
        type: "warning",
        msg: `${dstPath} is not array: byEnvironment attribute can only be injected to an array, ignoring`
      });
    }
    else {
      if (!dstExists)
        dstValue = dst[dstAttribute] = [];
      srcPath.pushArray();
      for (let envQuery in srcValue) {
        let matchingEnvs = buildTarget.resolveElements(reporter, envQuery);
        if (matchingEnvs.indexOf(buildTarget.environment) !== -1) {
          srcPath.setArrayKey(envQuery);
          let srcEnvValue = mapValue(srcPath, dstAttribute, srcValue[envQuery]);
          if (Array.isArray(srcEnvValue))
            mergeArrays(reporter, buildTarget, srcPath, dstValue, srcEnvValue);
          else {
            srcPath.diagnostic(reporter, {
              type: "warning",
              msg: `not an array: byEnvironment values must be an array, ignoring`
            });
          }
        }
      }
      srcPath.popArray();
    }
  }
  else {
    srcValue = mapValue(srcPath, dstAttribute, srcValue);
    let srcIsArray = srcValue ? Array.isArray(srcValue) : false;
    if (srcIsArray) {
      if (!dstIsArray && dstExists) {
        srcPath.diagnostic(reporter, {
          type: "warning",
          msg: `${dstPath} is not array: an array can only be injected to an array, ignoring`
        });
      }
      else {
        if (!dstExists)
          dstValue = dst[dstAttribute] = [];
        mergeArrays(reporter, buildTarget, srcPath, dstValue, srcValue);
      }
    }
    else if (dstIsArray) {
      srcPath.diagnostic(reporter, {
        type: "warning",
        msg: `not an array: an array can only be injected to an array, ignoring`
      });
    }
    else {
      if (keysWithSimpleValue.has(dstAttribute)) {
        if (srcValue !== dstValue) {
          srcPath.diagnostic(reporter, {
            type: "warning",
            msg: `collision on ${dstPath}: attribute is removed`
          });
          delete dst[dstAttribute];
        }
      }
      else if (!dstExists) {
        globalKeysWithSimpleValue.add(dstAttribute);
        keysWithSimpleValue.add(dstAttribute);
        dst[dstAttribute] = srcValue;
      }
    }
  }
}

export function injectElement(
  reporter: Reporter,
  src: Element, srcPath: AttributePath,
  dst: object, dstPath: AttributePath,
  buildTarget: BuildTargetElement,
  mapKey: (key: string) => string | '',
  mapValue: (at: AttributePath, key: string, value) => any,
  keysWithSimpleValue: Set<string>, globalKeysWithSimpleValue: Set<string>
) {
  srcPath.push('.', '');
  dstPath.push('.', '');
  for (let dstAttribute in src) {
    let srcAttribute = mapKey(dstAttribute);
    if (!srcAttribute)
      continue;
    injectAttribute(reporter,
      src, srcAttribute, srcPath.set(srcAttribute),
      dst, dstAttribute, dstPath.set(dstAttribute),
      buildTarget, mapValue, keysWithSimpleValue, globalKeysWithSimpleValue);
  }
  srcPath.pop(2);
  dstPath.pop(2);
}

export function injectElements(
  reporter: Reporter, elements: Element[],
  dst: object, dstPath: AttributePath,
  buildTarget: BuildTargetElement,
  mapKey: (key: string) => string | '' = defaultKeyMap,
  mapValue: (at: AttributePath, key: string, value) => any = defaultValueMap,
  globalKeysWithSimpleValue = new Set<string>()
) {
  let keysWithSimpleValue = new Set<string>();
  for (let element of elements)
    injectElement(reporter,
      element, new AttributePath(element),
      dst, dstPath,
      buildTarget, mapKey, mapValue, keysWithSimpleValue, globalKeysWithSimpleValue);
}

export function injectComponentsOf(
  reporter: Reporter, component: { components: ComponentElement[] },
  dst: object, dstPath: AttributePath,
  buildTarget: BuildTargetElement,
  mapKey: (key: string) => string | '' = defaultKeyMap,
  mapValue: (at: AttributePath, key: string, value) => any = defaultValueMap
) : ComponentElement[] {
  let injected = new Set<ComponentElement>();
  let globalKeysWithSimpleValue = new Set<string>();
  for (let sub of component.components)
    injectComponent(sub, globalKeysWithSimpleValue);

  function injectComponent(current: ComponentElement, keysWithSimpleValue: Set<string>) {
    injected.add(current);
    injectElement(reporter,
      current, new AttributePath(current),
      dst, dstPath,
      buildTarget, mapKey, mapValue, keysWithSimpleValue, globalKeysWithSimpleValue);
    if (current.components.length > 0) {
      let keysWithSimpleValue = new Set<string>();
      for (let sub of current.components)
        injectComponent(sub, keysWithSimpleValue);
    }
  }

  return [...injected];
}

function mergeArrays(reporter: Reporter, buildTarget: BuildTargetElement, srcPath: AttributePath, dstValue: any[], srcValue: any[]) {
  srcPath.pushArray();
  for (var i = 0, len = srcValue.length; i < len; i++) {
    var c = srcValue[i];
    if (c instanceof DelayedElement)
      dstValue.push(...<ComponentElement[]>c.__delayedResolve(reporter, buildTarget, srcPath.setArrayKey(i)));
    else
      dstValue.push(c);
  }
  srcPath.popArray();
}
