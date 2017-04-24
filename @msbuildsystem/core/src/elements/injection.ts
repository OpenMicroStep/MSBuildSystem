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

function injectElementAttribute(
  reporter: Reporter,
  depcomponent: Element, into: object, path: AttributePath,
  at: AttributePath, key: string, destKey: string,
  buildTarget: BuildTargetElement,
  mapValue: (at: AttributePath, key: string, value) => any,
  keysWithSimpleValue: Set<string>, globalKeysWithSimpleValue: Set<string>
) {
  let cvalue = into[destKey];
  let dvalue = depcomponent[key];
  let byenv = key.endsWith("ByEnvironment");
  if (byenv) {
    let cFinalKey = destKey.substring(0, destKey.length - "ByEnvironment".length);
    let cFinalValue = into[cFinalKey];
    if (cFinalValue !== undefined && !Array.isArray(cFinalValue)) {
      at.diagnostic(reporter, {
        type: "warning",
        msg: `attribute value is incoherent for injection into ${path}, '${cFinalKey}' must be an array, attribute is ignored`
      });
    }
    else {
      if (cFinalValue === undefined)
        cFinalValue = into[cFinalKey] = [];
      at.pushArray();
      for (var query in dvalue) {
        var envs = buildTarget.resolveElements(reporter, query);
        if (envs.indexOf(buildTarget.environment) !== -1) {
          var v = mapValue(at, key, dvalue[query]);
          at.setArrayKey(query);
          if (Array.isArray(v)) {
            mergeArrays(reporter, buildTarget, at, cFinalValue, v);
          }
          else {
            at.diagnostic(reporter, {
              type: "warning",
              msg: "attribute must contain an array"
            });
          }
        }
      }
      at.popArray();
    }
  }
  else {
    dvalue = mapValue(at, key, dvalue);
    let cvalueIsArr = cvalue ? Array.isArray(cvalue) : false;
    let dvalueIsArr = dvalue ? Array.isArray(dvalue) : false;
    if (cvalue !== undefined && cvalueIsArr !== dvalueIsArr) {
      at.diagnostic(reporter, {
        type: "warning",
        msg: `attribute value is incoherent for injection into ${path}, attribute is ignored`
      });
    }
    else if (dvalueIsArr) {
      if (!cvalue)
        cvalue = into[destKey] = [];
      mergeArrays(reporter, buildTarget, at, cvalue, dvalue);
    }
    else if (keysWithSimpleValue.has(destKey)) {
      if (cvalue !== dvalue) {
        at.diagnostic(reporter, {
          type: "warning",
          msg: `attribute value is incoherent for injection into ${path}, attribute is removed`
        });
        delete into[destKey];
      }
    }
    else if (cvalue === undefined) {
      globalKeysWithSimpleValue.add(destKey);
      keysWithSimpleValue.add(destKey);
      into[destKey] = dvalue;
    }
  }
}

export function injectElement(
  reporter: Reporter, element: Element,
  into: object, path: AttributePath,
  buildTarget: BuildTargetElement,
  mapKey: (key: string) => string | '',
  mapValue: (at: AttributePath, key: string, value) => any,
  keysWithSimpleValue: Set<string>, globalKeysWithSimpleValue: Set<string>
) {
  let at = new AttributePath(element, '.', '');
  for (let key in element) {
    let destKey = mapKey(key);
    if (!destKey)
      continue;
    at.set(key);
    injectElementAttribute(reporter, element, into, path, at, key, destKey, buildTarget, mapValue, keysWithSimpleValue, globalKeysWithSimpleValue);
  }
}

export function injectElements(
  reporter: Reporter, elements: Element[],
  into: object, path: AttributePath,
  buildTarget: BuildTargetElement,
  mapKey: (key: string) => string | '' = defaultKeyMap,
  mapValue: (at: AttributePath, key: string, value) => any = defaultValueMap,
  globalKeysWithSimpleValue = new Set<string>()
) {
  let keysWithSimpleValue = new Set<string>();
  for (let element of elements)
    injectElement(reporter, element, into, path, buildTarget, mapKey, mapValue, keysWithSimpleValue, globalKeysWithSimpleValue);
}

export function injectComponentsOf(
  reporter: Reporter, component: { components: ComponentElement[] },
  into: object, path: AttributePath,
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
    injectElement(reporter, current, into, path, buildTarget, mapKey, mapValue, keysWithSimpleValue, globalKeysWithSimpleValue);
    if (current.components.length > 0) {
      let keysWithSimpleValue = new Set<string>();
      for (let sub of current.components)
        injectComponent(sub, keysWithSimpleValue);
    }
  }

  return [...injected];
}

function mergeArrays(reporter: Reporter, buildTarget: BuildTargetElement, at: AttributePath, into: any[], from: any[]) {
  at.pushArray();
  for (var i = 0, len = from.length; i < len; i++) {
    var c = from[i];
    if (c instanceof DelayedElement)
      into.push(...<ComponentElement[]>c.__delayedResolve(reporter, buildTarget, at.setArrayKey(i)));
    else
      into.push(c);
  }
  at.popArray();
}
