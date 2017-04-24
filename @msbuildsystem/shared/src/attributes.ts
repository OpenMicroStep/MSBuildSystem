import {Reporter, util, AttributePath} from './index';

export type Value<T> = T[];
export type ComplexValue<T, E> = (({$?: T[] } & E) | T)[];

export type Validator<T, A0> = (reporter: Reporter, path: AttributePath, value: any, a0: A0) => T | undefined;
export type Validator0<T> = (reporter: Reporter, path: AttributePath, value: any) => T | undefined;
export type ValidatorNU<T, A0> = (reporter: Reporter, path: AttributePath, value: any, a0: A0) => T;
export type ValidatorNU0<T> = (reporter: Reporter, path: AttributePath, value: any) => T;
export type Reducer<T, R, C extends {}> = (reporter: Reporter, path: AttributePath, current: T, previous: R | undefined, context: C) => R;
export type MapValue<T> = (reporter: Reporter, path: AttributePath, value: any, values: T[], ...args) => void;
export type Extension<T, A0> = { validator: Validator<T, A0> | ValidatorNU<T, A0>, default: T };
export type Extension0<T> = { validator: Validator0<T> | ValidatorNU0<T>, default: T };
export type Extensions<T, A0> = { [K in keyof T]: Extension<T[K], A0> };
export type Extensions0<T> = { [K in keyof T]: Extension0<T[K]> };

export function superValidateList<T, A0> (
  reporter: Reporter, path: AttributePath, attr: T[], a0: A0,
  validator: Validator<T, A0>, push: (T) => void
) {
  if (Array.isArray(attr)) {
    path.pushArray();
    for (var idx = 0, attrlen = attr.length; idx < attrlen; idx++) {
      var value = validator(reporter, path.setArrayKey(idx), attr[idx], a0);
      if (value !== undefined)
        push(value);
    }
    path.popArray();
  }
  else {
    path.diagnostic(reporter, { type: "warning", msg: `attribute must be an array`});
  }
}

export function superFillDefaults<T, A0>(extensions: Extensions<T, A0>, into: T) : T {
  for (var path in extensions) {
    var ext = extensions[path];
    if (ext.default !== undefined && into[path] === undefined)
      into[path] = ext.default;
  }
  return into;
}

export function superFill<T, A0>(
  reporter: Reporter, path: AttributePath, attr: any, a0: A0,
  into: T, extensions: Extensions<T, A0>
) : T {
  path.pushArray();
  for (var k in extensions) {
    var ext = extensions[k];
    var v = attr[k];
    if (v !== undefined) {
      path.setArrayKey(k);
      v = ext.validator(reporter, path, v, a0);
    }
    if (v !== undefined)
      into[k] = v;
    else if (ext.default !== undefined)
      into[k] = ext.default;
  }
  path.popArray();
  return into;
}

export function superValidateObject<T, K, A0>(
  reporter: Reporter, path: AttributePath, attr: any, a0: A0,
  into: T & { [s: string]: K }, extensions: Extensions<T, A0>, objectForKeyValidator?: Validator<K, string>
) : T & { [s: string]: K } {
  path.pushArray();
  for (var k in attr as T) {
    var ext = extensions[k];
    var v = attr[k];
    path.setArrayKey(k);
    if (ext) {
      v = ext.validator(reporter, path, v, a0);
      if (v !== undefined)
        into[k] = v;
      else if (ext.default !== undefined)
        into[k] = ext.default as any;
    }
    else if (objectForKeyValidator) {
      v = objectForKeyValidator(reporter, path, v, k);
      if (v !== undefined)
        into[k] = v;
    }
    else {
      path.diagnostic(reporter, { type: "warning", msg: `attribute is unused` });
    }
  }
  path.popArray();
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
    superFillDefaults(extensions, value);
  }
  if (keys.length > 0)
    push(keys, value);
  return keys;
}

export function validateAny(reporter: Reporter, path: AttributePath, value: any, expected: string) {
  return value;
}

export function validateAnyToUndefined(reporter: Reporter, path: AttributePath, value: any, expected: string) {
  return undefined;
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

export function validateObject(reporter: Reporter, path: AttributePath, value: any) : object | undefined {
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

export function chain<T0, A0>(v0: Validator<T0, A0>) : T0 | undefined;
export function chain<T0, A0>(v0: Validator<any, A0>, v1: Validator<T0, A0>) : T0 | undefined;
export function chain<T0, A0>(v0: Validator<any, A0>, v1: Validator<any, A0>, v2: Validator<T0, A0>) : T0 | undefined;
export function chain<T0, A0>(v0: Validator<any, A0>, v1: Validator<any, A0>, v2: Validator<any, A0>, v3: Validator<T0, A0>) : T0 | undefined;
export function chain<A0>(v0: Validator<any, A0>, ...validators: Validator<any, A0>[]) : any {
  return function validateChain(reporter, path: AttributePath, value, a0: A0) {
    let i = 0;
    value = v0(reporter, path, value, a0);
    for (; value !== undefined && i < validators.length; i++)
      value = validators[i](reporter, path, value, a0);
    return value;
  };
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
export function objectValidator<T, K>(extensions: Extensions0<T>, objectForKeyValidator?: Validator<K, string>) : ValidatorNU0<T & { [s: string]: K }>;
export function objectValidator<T, K, A0>(extensions: Extensions<T, A0>, objectForKeyValidator?: Validator<K, string>) : ValidatorNU<T & { [s: string]: K }, A0>;
export function objectValidator<T, K, A0>(extensions: Extensions<T, A0>, objectForKeyValidator?: Validator<K, string>) {
  return function validateObject(reporter: Reporter, path: AttributePath, attr, a0: A0) : T & { [s: string]: K } {
    var ret = <T & { [s: string]: K }>{};
    if (typeof attr !== "object")
      path.diagnostic(reporter, { type: "warning", msg: `attribute must be a object, got ${typeof attr}`});
    else
      superValidateObject(reporter, path, attr, a0, ret, extensions, objectForKeyValidator);
    superFillDefaults(extensions, ret);
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

export function createReduceByMergingObjects({ allowMultipleValues }) {
  return function reduceByMergingObjects(reporter: Reporter, path: AttributePath, current: object, previous: object | undefined,
    context: { keysWithSimpleValue?: Set<string>, subContexts?: Map<Object, Object> }) : object {
    if (previous === undefined)
      previous = {};
    if (!context.keysWithSimpleValue)
      context.keysWithSimpleValue = new Set();
    path.push('.', '');
    for (var key in current as any) { // TODO: remove cast to any once tsc 2.3 is released (https://github.com/Microsoft/TypeScript/pull/14195)
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
        cvalue.push(...(allowMultipleValues ? dvalue : dvalue.filter(v => cvalue.indexOf(v) === -1)));
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
  };
}
export const reduceByMergingObjects = createReduceByMergingObjects({ allowMultipleValues: true });

export function mergedObjectListValidator<R>(extensions: Extensions0<R>) : Validator0<R>;
export function mergedObjectListValidator<R, A0>(extensions: Extensions<R, A0>) : Validator<R, A0>;
export function mergedObjectListValidator<R, A0>(extensions: Extensions<R, A0>) {
  return dynamicDefaultValueValidator(reducedListValidator(objectValidator(extensions), reduceByMergingObjects), (a0: A0) => {
    return superFillDefaults(extensions, {});
  });
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
