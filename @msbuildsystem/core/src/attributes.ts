import {Reporter, util, Diagnostic} from './index.priv';

export interface Attributes {
  components?: string[];
  [s: string]: any;
}

function listResolve<T, A0> (
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
    reporter.diagnostic({ type: "warning", msg: `attribute ${path.toString()} must be an array`});
  }
}

function validateComplex<T, T2, A0>(
  reporter: Reporter, path: AttributePath, attr: any, a0: A0,
  validator: AttributeTypes.Validator<T, A0>, extensions: AttributeResolvers.Extension<any, A0>[],
  push: (keys: T[], value: T2) => void
) {
  let keys = <T[]>[];
  let value = <T2>{};
  if (typeof attr === "object" && attr.value) { // complex object
    path.push('.value');
    listResolve(reporter, path, attr.value, a0, validator, keys.push.bind(keys));
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

  export function validateStringList(reporter: Reporter, path: AttributePath, value: string[]) {
    let ret = <string[]>[];
    listResolve(reporter, path, value, null!, validateString, ret.push.bind(ret));
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
  export abstract class Resolver<T, A0> {
    abstract resolve(reporter: Reporter, at: AttributePath, value, a0: A0) : T;
  }

  export class FunctionResolver<A0> extends Resolver<void, A0> {
    prototype: string;
    constructor(prototype: string) {
      super();
      this.prototype = prototype;
    }

    resolve(reporter: Reporter, at: AttributePath, value, a0: A0) {
      AttributeUtil.safeCall(reporter, value, this.prototype, null, at, a0);
    }
  }

  export class SimpleResolver<T, A0> extends Resolver<T | undefined, A0> {
    constructor(public validator: AttributeTypes.Validator<T, A0>) {
      super();
    }

    resolve(reporter: Reporter, path: AttributePath, attr, a0: A0) : T | undefined {
      return this.validator(reporter, path, attr, a0);
    }
  }

  export class ListResolver<T, A0> extends Resolver<T[], A0> {
    constructor(public validator: AttributeTypes.Validator<T, A0>) {
      super();
      this.validator = validator;
    }

    resolve(reporter: Reporter, path: AttributePath, attr, a0: A0) : T[] {
      let ret = [];
      listResolve(reporter, path, attr, a0, this.validator, ret.push.bind(ret));
      return ret;
    }
  }

  export type Extension<T, A0> = { path: string, validator: AttributeTypes.Validator<T, A0>, default: T };
  export class MapResolver<T, T2, A0> extends Resolver<Map<T, T2>, A0> {
    constructor(public validator: AttributeTypes.Validator<T, A0>, public extensions: Extension<any, A0>[]) {
      super();
    }

    resolve(reporter: Reporter, path: AttributePath, attr, a0: A0) : Map<T, T2> {
      var ret = new Map<T, T2>();
      listResolve(reporter, path, attr, a0, (reporter: Reporter, path: AttributePath, attr: any) => {
        return validateComplex(reporter, path, attr, a0, this.validator, this.extensions, function validate(keys: T[], value: T2) {
          for (var key of keys) {
            if (ret.has(key)) {
              // TODO: warn only when value differ ?
              reporter.diagnostic({ type: 'warning', msg: `attribute ${path.toString()} overwrite previous value` });
            }
            ret.set(key, value);
          }
        });
      }, function push() {});
      return ret;
    }
  }

  export class GroupResolver<T, T2, A0> extends Resolver<{values: T[], ext: T2}[], A0> {
    constructor(public validator: AttributeTypes.Validator<T, A0>, public extensions: Extension<any, A0>[]) {
      super();
    }

    resolve(reporter: Reporter, path: AttributePath, attr, a0: A0) : {values: T[], ext: T2}[] {
      var ret = <{values: T[], ext: T2}[]>[];
      var set = new Set<T>();
      listResolve(reporter, path, attr, a0, (reporter: Reporter, path: AttributePath, attr: any) => {
        return validateComplex(reporter, path, attr, a0, this.validator, this.extensions, function validate(keys: T[], value: T2) {
          for (var key of keys) {
            if (set.has(key))
              reporter.diagnostic({ type: 'warning', msg: `attribute ${path.toString()} is present multiple times` });
            set.add(key);
          }
          ret.push({values: keys, ext: value});
        });
      }, function pusth() {});
      return ret;
    }
  }

  export class SetResolver<T, A0>  extends Resolver<Set<T>, A0> {
    constructor(public validator: AttributeTypes.Validator<T, A0>) {
      super();
    }

    resolve(reporter: Reporter, path: AttributePath, attr, a0: A0) : Set<T> {
      let ret = new Set<T>();
      listResolve(reporter, path, attr, a0, this.validator, function(value) {
        ret.add(value);
      });
      return ret;
    }
  }

  export class ByEnvListResolver<T, A0> extends Resolver<{ [s: string]: T[] }, A0> {
    constructor(public validator: AttributeTypes.Validator<T, A0>) {
      super();
    }

    resolve(reporter: Reporter, path: AttributePath, attr, a0: A0) : { [s: string]: T[] } {
      var ret: { [s: string]: T[] } = {};
      if (typeof attr === "object") {
        path.push("");
        for (var k in attr) {
          var list = ret[k] = [];
          listResolve(reporter, path.set(k), attr[k], a0, this.validator, list.push.bind(list));
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
}

/** Very fast path management (push, pop) */
export type AttributePathComponent = ({ __path() : string } | string | number);
export class AttributePath {
  /** components of the path that are concatenated by toString() */
  components: AttributePathComponent[];

  constructor(...components: AttributePathComponent[]);
  constructor(c0?: AttributePathComponent, c1?: AttributePathComponent, c2?: AttributePathComponent) {
    this.reset.apply(this, arguments);
  }

  reset(...components: AttributePathComponent[]);
  reset(c0?: AttributePathComponent, c1?: AttributePathComponent, c2?: AttributePathComponent) {
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
