import {Reporter, util, AttributePath} from './index';

export type Value<T> = T[];
export type ComplexValue<T, E> = (({$?: T[] } & E) | T)[];

export type Validator<T, A0> = (reporter: Reporter, path: AttributePath, value: any, a0: A0) => T | undefined;
export type Validator0<T> = (reporter: Reporter, path: AttributePath, value: any) => T | undefined;
export type ValidatorNU<T, A0> = (reporter: Reporter, path: AttributePath, value: any, a0: A0) => T;
export type ValidatorNU0<T> = (reporter: Reporter, path: AttributePath, value: any) => T;
export type Reducer<T, R, C extends {}> = (reporter: Reporter, path: AttributePath, current: T, previous: R | undefined, context: C) => R;
export type MapValue<T> = (reporter: Reporter, path: AttributePath, value: any, values: T[], ...args) => void;
export type Extension<T, A0> = { validator: Validator<T, A0>, default: T };
export type Extension0<T> = { validator: Validator0<T>, default: T };
export type Extensions<T, A0> = { [K in keyof T]: Extension<T[K], A0> };
export type Extensions0<T> = { [K in keyof T]: Extension0<T[K]> };

export function superValidateList<T, A0> (
  reporter: Reporter, path: AttributePath, attr: T[], a0: A0,
  validator: Validator<T, A0>, push: (T) => void
) {
  if (Array.isArray(attr)) {
    path.push("[", "", "]");
    for (var idx = 0, attrlen = attr.length; idx < attrlen; idx++) {
      var value = validator(reporter, path.set(idx, -2), attr[idx], a0);
      if (value !== undefined)
        push(value);
    }
    path.pop(3);
  }
  else {
    path.diagnostic(reporter, { type: "warning", msg: `attribute must be an array`});
  }
}

export function superFillDefaults<T, A0>(extensions: Extensions<T, A0>, into: T, a0: A0) : T {
  for (var path in extensions) {
    var ext = extensions[path];
    into[path] = ext.default;
  }
  return into;
}

export function superFill<T, A0>(
  reporter: Reporter, path: AttributePath, attr: any, a0: A0,
  into: T, extensions: Extensions<T, A0>
) : T {
  path.push('[', '', ']');
  for (var k in extensions) {
    var ext = extensions[k];
    var v = attr[k];
    if (v !== undefined) {
      path.set(k, -2);
      v = ext.validator(reporter, path, v, a0);
    }
    into[k] = v !== undefined ? v : ext.default;
  }
  path.pop(3);
  return into;
}

export function superValidateComplex<T, T2, A0>(
  reporter: Reporter, path: AttributePath, attr: any, a0: A0,
  validator: Validator<T, A0>, extensions: Extensions<T2, A0>,
  push: (keys: T[], value: T2) => void
) {
  let keys = <T[]>[];
  let value = <T2>{};
  if (typeof attr === "object" && attr.value) { // complex object
    path.push('.value');
    superValidateList(reporter, path, attr.value, a0, validator, keys.push.bind(keys));
    path.pop();
    superFill(reporter, path, attr, a0, value, extensions);
  }
  else if ((attr = validator(reporter, path, attr, a0))) { // directly the object
    keys.push(attr);
    superFillDefaults(extensions, value, a0);
  }
  if (keys.length > 0)
    push(keys, value);
  return keys;
}

export function validateStringValue(reporter: Reporter, path: AttributePath, value: any, expected: string) {
  if (typeof value !== "string")
    path.diagnostic(reporter, {
      type: "warning",
      msg: `attribute must be the string '${expected}', got ${util.limitedDescription(value)}`
    });
  else if (value !== expected)
    path.diagnostic(reporter, { type: "warning", msg: `attribute must be '${expected}', got ${util.limitedDescription(value)}` });
  else
    return value;
  return undefined;
}

export function validateObject(reporter: Reporter, path: AttributePath, value: any) : { [s: string]: any } | undefined {
  if (typeof value !== "object")
    path.diagnostic(reporter, { type: "warning", msg: `attribute must be an object, got ${typeof value}`});
  else
    return value;
  return undefined;
}

export function validateArray(reporter: Reporter, path: AttributePath, value: any) {
  if (!Array.isArray(value))
    path.diagnostic(reporter, { type: "warning", msg: `attribute must be an array`});
  else
    return value;
  return [];
}
export function validateString(reporter: Reporter, path: AttributePath, value: any) {
  if (typeof value !== "string")
    path.diagnostic(reporter, { type: "warning", msg: `attribute must be a string, got ${typeof value}`});
  else if (value.length === 0)
    path.diagnostic(reporter, { type: "warning", msg: `attribute can't be an empty string`});
  else
    return value;
  return undefined;
}

export function validateBoolean(reporter: Reporter, path: AttributePath, value: any) {
  if (typeof value !== "boolean")
    path.diagnostic(reporter, { type: "warning", msg: `attribute must be a boolean, got ${typeof value}`});
  else
    return value;
  return undefined;
}

export function mapAfterValidator<T0, T1, A0>(validator: Validator<T0, A0>, map: (T0) => T1) : Validator<T1, A0> {
  return function validateWithAfterMap(reporter, path: AttributePath, value, a0: A0) {
    let t0 = validator(reporter, path, value, a0);
    if (t0 !== undefined)
      return map(t0);
    return undefined;
  };
}

export function defaultValueValidator<T, A0>(validator: Validator<T, A0>, defaultValue: T) : Validator<T, A0> {
  return function validateWithDefaultValue(reporter, path: AttributePath, value, a0: A0) {
    if (value === undefined || (value = validator(reporter, path, value, a0)) === undefined)
      return defaultValue;
    return value;
  };
}
export function dynamicDefaultValueValidator<T, A0>(validator: Validator<T, A0>, createDefaultValue: (a0: A0) => T) : Validator<T, A0> {
  return function validateWithDefaultValue(reporter, path: AttributePath, value, a0: A0) {
    if (value === undefined || (value = validator(reporter, path, value, a0)) === undefined)
      return createDefaultValue(a0);
    return value;
  };
}

export function functionValidator<A0>(prototype: string) : Validator<void, A0> {
  return function validateFunction(reporter, path: AttributePath, value, a0: A0) {
    AttributeUtil.safeCall(reporter, value, prototype, null, path, a0);
  };
}

export function listValidator<T>(validator: Validator0<T>) : ValidatorNU0<T[]>;
export function listValidator<T, A0>(validator: Validator<T, A0>) : ValidatorNU<T[], A0>;
export function listValidator<T, A0>(validator: Validator<T, A0>) {
  return function validateList(reporter: Reporter, path: AttributePath, attr, a0: A0) : T[] {
    let ret = [];
    superValidateList(reporter, path, attr, a0, validator, ret.push.bind(ret));
    return ret;
  };
}

export function objectValidator<T>(extensions: Extensions0<T>) : ValidatorNU0<T>;
export function objectValidator<T, A0>(extensions: Extensions<T, A0>) : ValidatorNU<T, A0>;
export function objectValidator<T, A0>(extensions: Extensions<T, A0>) {
  return function validateObject(reporter: Reporter, path: AttributePath, attr, a0: A0) : T {
    var ret = <T>{};
    if (typeof attr !== "object") {
      path.diagnostic(reporter, { type: "warning", msg: `attribute must be a object, got ${typeof attr}`});
      superFillDefaults(extensions, ret, a0);
    }
    else {
      superFill(reporter, path, attr, a0, ret, extensions);
    }
    return ret;
  };
}

export function mapValidator<T, T2>(validator: Validator0<T>, extensions: Extensions0<T2>) : ValidatorNU0<Map<T, T2>>;
export function mapValidator<T, T2, A0>(validator: Validator<T, A0>, extensions: Extensions<T2, A0>) : ValidatorNU<Map<T, T2>, A0>;
export function mapValidator<T, T2, A0>(validator: Validator<T, A0>, extensions: Extensions<T2, A0>) {
  return function validateMap(reporter: Reporter, path: AttributePath, attr, a0: A0) : Map<T, T2> {
    var ret = new Map<T, T2>();
    superValidateList(reporter, path, attr, a0, (reporter: Reporter, path: AttributePath, attr: any) => {
      return superValidateComplex(reporter, path, attr, a0, validator, extensions, function validate(keys: T[], value: T2) {
        for (var key of keys) {
          if (ret.has(key)) {
            // TODO: warn only when value differ ?
            path.diagnostic(reporter, { type: 'warning', msg: `attribute overwrite previous value` });
          }
          ret.set(key, value);
        }
      });
    }, function push() {});
    return ret;
  };
}

export function groupValidator<T, T2>(validator: Validator0<T>, extensions: Extensions0<T2>) : ValidatorNU0<{values: T[], ext: T2}[]>;
export function groupValidator<T, T2, A0>(validator: Validator<T, A0>, extensions: Extensions<T2, A0>) : ValidatorNU<{values: T[], ext: T2}[], A0>;
export function groupValidator<T, T2, A0>(validator: Validator<T, A0>, extensions: Extensions<T2, A0>) {
  return function validateGroup(reporter: Reporter, path: AttributePath, attr, a0: A0) : {values: T[], ext: T2}[] {
    var ret = <{values: T[], ext: T2}[]>[];
    var set = new Set<T>();
    superValidateList(reporter, path, attr, a0, (reporter: Reporter, path: AttributePath, attr: any) => {
      return superValidateComplex(reporter, path, attr, a0, validator, extensions, function validate(keys: T[], value: T2) {
        for (var key of keys) {
          if (set.has(key))
            path.diagnostic(reporter, { type: 'warning', msg: `attribute is present multiple times` });
          set.add(key);
        }
        ret.push({values: keys, ext: value});
      });
    }, function pusth() {});
    return ret;
  };
}

export function setValidator<T>(validator: Validator0<T>) : ValidatorNU0<Set<T>>;
export function setValidator<T, A0>(validator: Validator<T, A0>) : ValidatorNU<Set<T>, A0>;
export function setValidator<T, A0>(validator: Validator<T, A0>) {
  return function validateSet(reporter: Reporter, path: AttributePath, attr, a0: A0) : Set<T> {
    let ret = new Set<T>();
    superValidateList(reporter, path, attr, a0, validator, function(value) {
      ret.add(value);
    });
    return ret;
  };
}

export function byEnvListValidator<T>(validator: Validator0<T>) : ValidatorNU0<{ [s: string]: T[] }>;
export function byEnvListValidator<T, A0>(validator: Validator<T, A0>) : ValidatorNU<{ [s: string]: T[] }, A0>;
export function byEnvListValidator<T, A0>(validator: Validator<T, A0>) {
  return function validateByEnvList(reporter: Reporter, path: AttributePath, attr, a0: A0) : { [s: string]: T[] } {
    var ret: { [s: string]: T[] } = {};
    if (typeof attr === "object") {
      path.push("[", "", "]");
      for (var k in attr) {
        var list = ret[k] = [];
        superValidateList(reporter, path.set(k, -2), attr[k], a0, validator, list.push.bind(list));
      }
      path.pop(3);
    }
    else {
      path.diagnostic(reporter, { type: "warning", msg: `attribute must be an array`});
    }
    return ret;
  };
}

export function reducedListValidator<T, R, C>(validator: Validator0<T>, reduce: Reducer<T, R, C>) : Validator0<R>;
export function reducedListValidator<T, R, C, A0>(validator: Validator<T, A0>, reduce: Reducer<T, R, C>) : Validator<R, A0>;
export function reducedListValidator<T, R, C, A0>(validator: Validator<T, A0>, reduce: Reducer<T, R, C>) {
  return function validateReducedList(reporter: Reporter, path: AttributePath, attr, a0: A0) : R | undefined {
    let previous: R | undefined = undefined;
    let context = {};
    superValidateList(reporter, path, attr, a0, validator, (value) => {
      previous = reduce(reporter, path, value, previous, <C>context);
    });
    return previous;
  };
}

export function mergedObjectListValidator<R>(extensions: Extensions0<R>) : Validator0<R>;
export function mergedObjectListValidator<R, A0>(extensions: Extensions<R, A0>) : Validator<R, A0>;
export function mergedObjectListValidator<R, A0>(extensions: Extensions<R, A0>) {
  return dynamicDefaultValueValidator(reducedListValidator(objectValidator(extensions), reduceByMergingObjects), (a0: A0) => {
    return superFillDefaults(extensions, {}, a0);
  });
}

export function reduceByMergingObjects(reporter: Reporter, path: AttributePath, current: { [s: string]: any }, previous: { [s: string]: any } | undefined,
  context: { keysWithSimpleValue?: Set<string>, subContexts?: Map<Object, Object> }) : { [s: string]: any } {
  if (previous === undefined)
    previous = {};
  if (!context.keysWithSimpleValue)
    context.keysWithSimpleValue = new Set();
  path.push('.', '');
  for (var key in current) {
    var cvalue = previous[key];
    var dvalue = current[key];
    var cvalueIsArr = cvalue ? Array.isArray(cvalue) : false;
    var dvalueIsArr = dvalue ? Array.isArray(dvalue) : false;
    var cvalueIsObj = typeof cvalue === "object";
    var dvalueIsObj = typeof dvalue === "object";
    if (cvalue === dvalue) {}
    else if (cvalue !== undefined && (cvalueIsArr !== dvalueIsArr || cvalueIsObj !== dvalueIsObj)) {
      path.set(key).diagnostic(reporter, {
        type: "warning",
        msg: `attribute value is incoherent for merging, attribute is ignored`
      });
    }
    else if (dvalueIsArr) {
      if (!cvalue)
        cvalue = previous[key] = [];
      cvalue.push(...dvalue);
    }
    else if (dvalueIsObj) {
      if (!cvalue)
        cvalue = previous[key] = {};
      if (!context.subContexts)
        context.subContexts = new Map();
      let subcontext = context.subContexts.get(cvalue);
      if (!subcontext)
        context.subContexts.set(cvalue, subcontext = {});
      reduceByMergingObjects(reporter, path, dvalue, cvalue, subcontext);
    }
    else if (context.keysWithSimpleValue.has(key)) {
      path.set(key).diagnostic(reporter, {
        type: "warning",
        msg: `attribute value is incoherent for injection, attribute is removed`
      });
    }
    else if (cvalue === undefined) {
      context.keysWithSimpleValue.add(key);
      previous[key] = dvalue;
    }
  }
  path.pop(2);
  return previous;
}

export const validateStringList = listValidator(validateString);
export const validateStringSet = setValidator(validateString);
export const validateMergedObjectList = reducedListValidator(validateObject, reduceByMergingObjects);


export module AttributeUtil {
  export function safeCall(reporter: Reporter, fn: Function, signature: string, defaultReturnValue: any, path: AttributePath, ...args) {
    if (!fn) return defaultReturnValue;

    if (typeof fn !== "function") {
      path.diagnostic(reporter, {
        type: "error",
        msg: `attribute must be a function with signature ${signature}`
      });
    }
    else {
      try {
        return fn(...args);
      } catch (e) {
        reporter.error(e, {
          type: "error",
          msg: `attribute must be a function with signature ${signature}`
        });
      }
    }
    return defaultReturnValue;
  }
}
