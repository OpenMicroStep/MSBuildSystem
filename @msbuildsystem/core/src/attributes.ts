import {Reporter, util, Diagnostic} from './index.priv';

export interface Attributes {
  components?: string[];
  [s: string]: any;
}

function superValidateList<T, A0> (
  reporter: Reporter, path: AttributePath, attr: T[], a0: A0,
  validator: AttributeTypes.Validator<T, A0>, push: (T) => void
) {
  if (Array.isArray(attr)) {
    path.push("[", "", "]");
    for (var idx = 0, attrlen = attr.length; idx < attrlen; idx++) {
      var value = validator(reporter, path.set(idx.toString(), -1), attr[idx], a0);
      if (value !== undefined)
        push(value);
    }
    path.pop(3);
  }
  else {
    path.diagnostic(reporter, { type: "warning", msg: `attribute must be an array`});
  }
}

function superValidateComplex<T, T2, A0>(
  reporter: Reporter, path: AttributePath, attr: any, a0: A0,
  validator: AttributeTypes.Validator<T, A0>, extensions: AttributeTypes.Extension<any, A0>[],
  push: (keys: T[], value: T2) => void
) {
  let keys = <T[]>[];
  let value = <T2>{};
  if (typeof attr === "object" && attr.value) { // complex object
    path.push('.value');
    superValidateList(reporter, path, attr.value, a0, validator, keys.push.bind(keys));
    path.pop();
    for (let i = 0, len = extensions.length; i < len; i++) {
      let ext = extensions[i];
      let v = attr[ext.path];
      if (v !== undefined) {
        path.set(ext.path, -2);
        v = ext.validator(reporter, path, v, a0);
      }
      value[ext.path] = v !== undefined ? v : ext.default;
    }
  }
  else if ((attr = validator(reporter, path, attr, a0))) { // directly the object
    keys.push(attr);
    for (let i = 0, len = extensions.length; i < len; i++) {
      let ext = extensions[i];
      value[ext.path] = ext.default;
    }
  }
  push(keys, value);
  return keys;
}

export module AttributeTypes {
  export type Value<T> = T[];
  export type ComplexValue<T, E> = (({$?: T[] } & E) | T)[];

  export type Validator<T, A0> = (reporter: Reporter, path: AttributePath, value: any, a0: A0) => T | undefined;
  export type Validator0<T> = (reporter: Reporter, path: AttributePath, value: any) => T | undefined;
  export type ValidatorNU<T, A0> = (reporter: Reporter, path: AttributePath, value: any, a0: A0) => T;
  export type ValidatorNU0<T> = (reporter: Reporter, path: AttributePath, value: any) => T;
  export type Reducer<T, R> = (reporter: Reporter, current: T, previous: R | undefined) => R;
  export type MapValue<T> = (reporter: Reporter, path: AttributePath, value: any, values: T[], ...args) => void;
  export type Extension<T, A0> = { path: string, validator: AttributeTypes.Validator<T, A0>, default: T };
  export type Extension0<T> = { path: string, validator: AttributeTypes.Validator0<T>, default: T };

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
      path.diagnostic(reporter, { type: "warning", msg: `attribute must be a object, got ${typeof value}`});
    else
      return value;
    return undefined;
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
      if (value === undefined)
        return defaultValue;
      return validator(reporter, path, value, a0);
    };
  }
  export function dynamicDefaultValueValidator<T, A0>(validator: Validator<T, A0>, createDefaultValue: (a0: A0) => T) : Validator<T, A0> {
    return function validateWithDefaultValue(reporter, path: AttributePath, value, a0: A0) {
      if (value === undefined)
        return createDefaultValue(a0);
      return validator(reporter, path, value, a0);
    };
  }

  export function functionValidator<A0>(prototype: string) : Validator<void, A0> {
    return function validateFunction(reporter, path: AttributePath, value, a0: A0) {
      AttributeUtil.safeCall(reporter, value, prototype, null, path, a0);
    };
  }

  export function listValidator<T>(validator: AttributeTypes.Validator0<T>) : ValidatorNU0<T[]>;
  export function listValidator<T, A0>(validator: AttributeTypes.Validator<T, A0>) : ValidatorNU<T[], A0>;
  export function listValidator<T, A0>(validator: AttributeTypes.Validator<T, A0>) {
    return function validateList(reporter: Reporter, path: AttributePath, attr, a0: A0) : T[] {
      let ret = [];
      superValidateList(reporter, path, attr, a0, validator, ret.push.bind(ret));
      return ret;
    };
  }

  export function mapValidator<T, T2>(validator: AttributeTypes.Validator0<T>, extensions: Extension0<any>[]) : ValidatorNU0<Map<T, T2>>;
  export function mapValidator<T, T2, A0>(validator: AttributeTypes.Validator<T, A0>, extensions: Extension<any, A0>[]) : ValidatorNU<Map<T, T2>, A0>;
  export function mapValidator<T, T2, A0>(validator: AttributeTypes.Validator<T, A0>, extensions: Extension<any, A0>[]) {
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

  export function groupValidator<T, T2>(validator: AttributeTypes.Validator0<T>, extensions: Extension0<any>[]) : ValidatorNU0<{values: T[], ext: T2}[]>;
  export function groupValidator<T, T2, A0>(validator: AttributeTypes.Validator<T, A0>, extensions: Extension<any, A0>[]) : ValidatorNU<{values: T[], ext: T2}[], A0>;
  export function groupValidator<T, T2, A0>(validator: AttributeTypes.Validator<T, A0>, extensions: Extension<any, A0>[]) {
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

  export function setValidator<T>(validator: AttributeTypes.Validator0<T>) : ValidatorNU0<Set<T>>;
  export function setValidator<T, A0>(validator: AttributeTypes.Validator<T, A0>) : ValidatorNU<Set<T>, A0>;
  export function setValidator<T, A0>(validator: AttributeTypes.Validator<T, A0>) {
    return function validateSet(reporter: Reporter, path: AttributePath, attr, a0: A0) : Set<T> {
      let ret = new Set<T>();
      superValidateList(reporter, path, attr, a0, validator, function(value) {
        ret.add(value);
      });
      return ret;
    };
  }

  export function byEnvListValidator<T>(validator: AttributeTypes.Validator0<T>) : ValidatorNU0<{ [s: string]: T[] }>;
  export function byEnvListValidator<T, A0>(validator: AttributeTypes.Validator<T, A0>) : ValidatorNU<{ [s: string]: T[] }, A0>;
  export function byEnvListValidator<T, A0>(validator: AttributeTypes.Validator<T, A0>) {
    return function validateByEnvList(reporter: Reporter, path: AttributePath, attr, a0: A0) : { [s: string]: T[] } {
      var ret: { [s: string]: T[] } = {};
      if (typeof attr === "object") {
        path.push("");
        for (var k in attr) {
          var list = ret[k] = [];
          superValidateList(reporter, path.set(k), attr[k], a0, validator, list.push.bind(list));
        }
        path.pop();
      }
      else {
        path.diagnostic(reporter, { type: "warning", msg: `attribute must be an array`});
      }
      return ret;
    };
  }

  export function reducedListValidator<T, R>(validator: AttributeTypes.Validator0<T>, reduce: AttributeTypes.Reducer<T, R>) : Validator0<R>;
  export function reducedListValidator<T, R, A0>(validator: AttributeTypes.Validator<T, A0>, reduce: AttributeTypes.Reducer<T, R>) : Validator<R, A0>;
  export function reducedListValidator<T, R, A0>(validator: AttributeTypes.Validator<T, A0>, reduce: AttributeTypes.Reducer<T, R>) {
    return function validateReducedList(reporter: Reporter, path: AttributePath, attr, a0: A0) : R | undefined {
      let previous: R | undefined = undefined;
      superValidateList(reporter, path, attr, a0, validator, (value) => {
        previous = reduce(reporter, value, previous);
      });
      return previous;
    };
  }

  export function reduceByMergingObjects(reporter: Reporter, current: { [s: string]: any }, previous: { [s: string]: any } | undefined) : { [s: string]: any } {
    return Object.assign(previous || {}, current);
  }

  export const validateStringList = listValidator(AttributeTypes.validateString);
  export const validateStringSet = setValidator(AttributeTypes.validateString);
  export const validateMergedObjectList = reducedListValidator(AttributeTypes.validateObject, AttributeTypes.reduceByMergingObjects);
}

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

  export function isArray(reporter: Reporter, path: AttributePath, value: any) {
    var ret = Array.isArray(value);
    if (!ret)
      path.diagnostic(reporter, { type: "warning", msg: `attribute must be an array`});
    return ret;
  }
}

/** Very fast path management (push, pop) */
export type AttributePathComponent = ({ __path() : string } | string | number);
export class AttributePath {
  /** components of the path that are concatenated by toString() */
  components: AttributePathComponent[];

  constructor(...components: AttributePathComponent[]);
  constructor() {
    this.reset.apply(this, arguments);
  }

  reset(...components: AttributePathComponent[]);
  reset() {
    var length = arguments.length;
    this.components = [];
    for (var i = 0; i < length; i++)
      this.components.push(arguments[i]);
    return this;
  }

  push(...components: AttributePathComponent[]);
  push() {
    var length = arguments.length;
    for (var i = 0; i < length; i++)
      this.components.push(arguments[i]);
    return this;
  }

  pop(nb: number = 1) {
    while (--nb >= 0)
      this.components.pop();
    return this;
  }

  rewrite(...components: AttributePathComponent[])
  rewrite() {
    var i = 0, len = arguments.length;
    var end = this.components.length - len;
    while (i < len)
      this.components[end++] = arguments[i++];
  }

  set(attr: AttributePathComponent, at: number = -1) {
    this.components[at < 0 ? this.components.length + at : at] = attr;
    return this;
  }

  copy() {
    var cpy = new AttributePath();
    cpy.components = this.components.slice(0);
    return cpy;
  }

  toString() : string {
    return this.components.map(c => typeof c === "object" ? c.__path() : c).join('');
  }

  diagnostic(reporter: Reporter, d: Diagnostic, ...components: AttributePathComponent[]) {
    this.push(...components);
    d.path = this.toString() + (d.path || "");
    this.pop(components.length);
    reporter.diagnostic(d);
  }
}
