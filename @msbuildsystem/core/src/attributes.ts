import {Reporter, util} from './index.priv';

export interface Attributes {
  components?: string[];
  [s: string]: any;
}

function listResolve<T> (reporter: Reporter, validator: AttributeTypes.Validator<T>, attr, path: AttributePath, push: (T) => void) {
  path.push("[", "", "]");
  if (Array.isArray(attr)) {
    for (var idx = 0, attrlen = attr.length; idx < attrlen; idx++) {
      var value = validator(reporter, path.set(idx.toString(), -1), attr[idx]);
      if (value !== undefined)
        push(value);
    }
  }
  else {
    reporter.diagnostic({ type: "warning", msg: `attribute ${path.toString()} must be an array`});
  }
  path.pop(3);
}

function validateComplex<T, T2>(
  reporter: Reporter, path: AttributePath, attr: any,
  validator: AttributeTypes.Validator<T>, extensions: AttributeResolvers.Extension<any>[],
  push: (keys: T[], value: T2) => void
) {
  let keys = <T[]>[];
  let value = <T2>{};
  if (typeof attr === "object" && attr.value) { // complex object
    path.push('.value');
    listResolve(reporter, validator, path, attr.value, keys.push.bind(keys));
    path.pop();
    for (let i = 0, len = extensions.length; i < len; i++) {
      let ext = extensions[i];
      let v = attr[ext.path];
      if (v !== undefined) {
        path.set(ext.path, -2);
        v = ext.validator(reporter, path, v);
      }
      value[ext.path] = v !== undefined ? v : ext.default;
    }
  }
  else if ((attr= validator(reporter, path, attr))) { // directly the object
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

  export type Validator<T> = (reporter: Reporter, path: AttributePath, value: any, ...args) => T | undefined;
  export type MapValue<T> = (reporter: Reporter, path: AttributePath, value: any, values: T[], ...args) => void;

  export function validateStringValue(reporter: Reporter, path: AttributePath, value: any, expected: string) {
    if (typeof value !== "string")
      reporter.diagnostic({
        type: "warning",
        msg: `attribute ${path.toString()} must be the string '${expected}', got ${util.limitedDescription(value)}`
      });
    else if (value !== expected)
      reporter.diagnostic({ type: "warning", msg: `attribute ${path.toString()} must be '${expected}', got ${util.limitedDescription(value)}` });
    else
      return value;
    return undefined;
  }

  export function validateStringList(reporter: Reporter, path: AttributePath, value: any) {
    let ret = <string[]>[];
    listResolve(reporter, validateString, value, path, ret.push.bind(ret));
    return ret;
  }

  export function validateObject(reporter: Reporter, path: AttributePath, value: any) {
    if (typeof value !== "object")
      reporter.diagnostic({ type: "warning", msg: `attribute ${path.toString()} must be a object, got ${typeof value}`});
    else
      return value;
    return undefined;
  }
  export function validateString(reporter: Reporter, path: AttributePath, value: any) {
    if (typeof value !== "string")
      reporter.diagnostic({ type: "warning", msg: `attribute ${path.toString()} must be a string, got ${typeof value}`});
    else if (value.length === 0)
      reporter.diagnostic({ type: "warning", msg: `attribute ${path.toString()} can't be an empty string`});
    else
      return value;
    return undefined;
  }

  export function validateBoolean(reporter: Reporter, path: AttributePath, value: any) {
    if (typeof value !== "boolean")
      reporter.diagnostic({ type: "warning", msg: `attribute ${path.toString()} must be a boolean, got ${typeof value}`});
    else
      return value;
    return undefined;
  }
}

export module AttributeUtil {
  export function safeCall(reporter: Reporter, fn: Function, signature: string, defaultReturnValue: any, path: AttributePath, ...args) {
    if (!fn) return defaultReturnValue;

    if (typeof fn !== "function") {
      reporter.diagnostic({
        type: "error",
        msg: `attribute ${path.toString()} must be a function with signature ${signature}`
      });
    }
    else {
      try {
        return fn(...args);
      } catch (e) {
        reporter.error(e, {
          type: "error",
          msg: `attribute ${path.toString()} must be a function with signature ${signature}`
        });
      }
    }
    return defaultReturnValue;
  }

  export function isArray(reporter: Reporter, path: AttributePath, value: any) {
    var ret = Array.isArray(value);
    if (!ret)
      reporter.diagnostic({ type: "warning", msg: `attribute ${path.toString()} must be an array`});
    return ret;
  }
}

export module AttributeResolvers {
  export abstract class Resolver<T> {
    abstract resolve(reporter: Reporter, value, at: AttributePath, ...args) : T;
  }

  export class FunctionResolver extends Resolver<void> {
    prototype: string;
    constructor(prototype: string) {
      super();
      this.prototype = prototype;
    }

    resolve(reporter: Reporter, value, at: AttributePath, ...args) {
      AttributeUtil.safeCall(reporter, value, this.prototype, null, at, ...args);
    }
  }

  export class SimpleResolver<T> extends Resolver<T | undefined> {
    constructor(public validator: AttributeTypes.Validator<T>) {
      super();
    }

    resolve(reporter: Reporter, attr, path: AttributePath) : T | undefined {
      return this.validator(reporter, path, attr);
    }
  }

  export class ListResolver<T> extends Resolver<T[]> {
    validator: AttributeTypes.Validator<T>;

    constructor(validator: AttributeTypes.Validator<T>) {
      super();
      this.validator = validator;
    }

    resolve(reporter: Reporter, attr, path: AttributePath) : T[] {
      let ret = [];
      listResolve(reporter, this.validator, attr, path, ret.push.bind(ret));
      return ret;
    }
  }

  export type Extension<T> = { path: string, validator: AttributeTypes.Validator<T>, default: T };
  export class MapResolver<T, T2> extends Resolver<Map<T, T2>> {
    constructor(public validator: AttributeTypes.Validator<T>, public extensions: Extension<any>[]) {
      super();
    }

    resolve(reporter: Reporter, attr, path: AttributePath) : Map<T, T2> {
      var ret = new Map<T, T2>();
      listResolve(reporter, (reporter: Reporter, path: AttributePath, attr: any) => {
        return validateComplex(reporter, path, attr, this.validator, this.extensions, function(keys: T[], value: T2) {
          for (var key of keys) {
            if (ret.has(key)) {
              // TODO: warn only when value differ ?
              reporter.diagnostic({ type: 'warning', msg: `attribute ${path.toString()} overwrite previous value` });
            }
            ret.set(key, value);
          }
        });
      }, attr, path, function() {});
      return ret;
    }
  }

  export class GroupResolver<T, T2> extends Resolver<{values: T[], ext: T2}[]> {
    constructor(public validator: AttributeTypes.Validator<T>, public extensions: Extension<any>[]) {
      super();
    }

    resolve(reporter: Reporter, attr, path: AttributePath) : {values: T[], ext: T2}[] {
      var ret = <{values: T[], ext: T2}[]>[];
      var set = new Set<T>();
      listResolve(reporter, (reporter: Reporter, path: AttributePath, attr: any) => {
        return validateComplex(reporter, path, attr, this.validator, this.extensions, function(keys: T[], value: T2) {
          for (var key of keys) {
            if (set.has(key))
              reporter.diagnostic({ type: 'warning', msg: `attribute ${path.toString()} is present multiple times` });
            set.add(key);
          }
          ret.push({values: keys, ext: value});
        });
      }, attr, path, function() {});
      return ret;
    }
  }

  export class SetResolver<T>  extends Resolver<Set<T>> {
    validator: AttributeTypes.Validator<T>;

    constructor(validator: AttributeTypes.Validator<T>) {
      super();
      this.validator = validator;
    }

    resolve(reporter: Reporter, attr, path: AttributePath) : Set<T> {
      let ret = new Set<T>();
      listResolve(reporter, this.validator, attr, path, function(value) {
        ret.add(value);
      });
      return ret;
    }
  }

  export class ByEnvListResolver<T> extends Resolver<{ [s: string]: T[] }> {
    validator: AttributeTypes.Validator<T>;

    constructor(validator: AttributeTypes.Validator<T>) {
      super();
      this.validator = validator;
    }

    resolve(reporter: Reporter, attr, path: AttributePath) : { [s: string]: T[] } {
      var ret: { [s: string]: T[] } = {};
      if (typeof attr === "object") {
        path.push("");
        for (var k in attr) {
          var list = ret[k] = [];
          listResolve(reporter, this.validator, attr[k], path.set(k), list.push.bind(list));
        }
        path.pop();
      }
      else {
        reporter.diagnostic({ type: "warning", msg: `attribute ${path.toString()} must be an array`});
      }
      return ret;
    }
  }

  export const stringListResolver = new ListResolver(AttributeTypes.validateString);
  export const stringResolver = new SimpleResolver(AttributeTypes.validateString);
  export const stringSetResolver = new SetResolver(AttributeTypes.validateString);
  export const defaultString = "8c41b119-e7ae-4cf9-888f-d65a88faacec";
}

export class AttributePath {
  path: string[];

  constructor(path?: string) {
    this.path = path !== undefined ? [path] : [];
  }

  push(...attr: string[]) {
    this.path.push(...attr);
    return this;
  }

  pop(nb: number = 1) {
    while (--nb >= 0)
      this.path.pop();
    return this;
  }

  set(attr: string, at: number = -1) {
    this.path[at < 0 ? this.path.length + at : at] = attr;
    return this;
  }

  last() : string {
    return this.path[this.path.length - 1];
  }

  copy() {
    var cpy = new AttributePath();
    cpy.path = this.path.slice(0);
    return cpy;
  }

  toString() : string {
    var ret = "";
    var addPoint = false;
    for (var i = 0, len = this.path.length; i < len; ++i) {
      var p = this.path[i];
      if (p) {
        if (addPoint && p !== "[" && p !== "]" && p[0] !== ".")
          ret += ":";
        ret += p;
      }
      addPoint = p !== "[";
    }
    return ret;
  }
}
