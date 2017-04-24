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
export function injectElements(
  reporter: Reporter, elements: Element[],
  into: object, path: AttributePath,
  buildTarget: BuildTargetElement,
  mapKey: (key: string) => string | '' = defaultKeyMap,
  mapValue: (at: AttributePath, key: string, value) => any = defaultValueMap,
) {
  let keysWithSimpleValue = new Set<string>();
  for (let depcomponent of elements) {
    let at = new AttributePath(depcomponent, '.', '');
    for (let key in depcomponent) {
      let destKey = mapKey(key);
      if (!destKey)
        continue;
      at.set(key);
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
          keysWithSimpleValue.add(destKey);
          into[destKey] = dvalue;
        }
      }
    }
  }
}

export function injectComponentsOf(
  reporter: Reporter, component: { components: ComponentElement[] },
  into: object, path: AttributePath,
  buildTarget: BuildTargetElement,
  mapKey: (key: string) => string | '' = defaultKeyMap,
  mapValue: (at: AttributePath, key: string, value) => any = defaultValueMap
) : ComponentElement[] {
  let injected = new Set<ComponentElement>();
  function injectComponents(current: { components: ComponentElement[] }) {
    if (current !== component)
      injected.add(<ComponentElement>current);
    if (current.components) {
      injectElements(reporter, current.components, into, path, buildTarget, mapKey, mapValue);
      for (let next of current.components)
        injectComponents(next);
    }
  }
  injectComponents(component);
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
