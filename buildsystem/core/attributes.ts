import {Task} from './task';
import {Target} from './target';
import {Reporter} from './runner';
import {deepEqual, limitedDescription} from './util';

export interface Attributes {
  components?: string[];
  [s: string]: any;
}

export module AttributeTypes {
  export type Value<T> = T[];
  export type ComplexValue<T, E> = (({$?: T[] } & E) | T)[];
  
  export type Validator<T> = (reporter: Reporter, path: AttributePath, value: any, ...args) => T;
  export type MapValue<T> = (reporter: Reporter, path: AttributePath, value: any, values: T[], ...args) => void;

  export function validateStringValue(reporter: Reporter, path: AttributePath, value: any, expected: string) {
    if (typeof value !== "string")
      reporter.diagnostic({ type: "warning", msg: `attribute ${path.toString()} must be the string '${expected}', got ${limitedDescription(value)}`});
    else if (value !== expected)
      reporter.diagnostic({ type: "warning", msg: `attribute ${path.toString()} must be '${expected}', got ${limitedDescription(value)}` });
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
      }
      catch(e) {
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
      reporter.diagnostic({ type: "warning", msg: `attribute ${path.toString()} must be an array`})
    return ret;
  }
}

export module AttributeResolvers {
  export interface Resolver<T> {
    resolve(reporter: Reporter, value, at: AttributePath, ...args) : T;
  }

  export class FunctionResolver implements Resolver<void> {
    prototype: string;
    constructor(prototype: string) {
      this.prototype = prototype;
    }
    
    resolve(reporter: Reporter, value, at: AttributePath, ...args) {
      AttributeUtil.safeCall(reporter, value, this.prototype, null, at, ...args);
    }
  }


  function listResolve<T> (reporter: Reporter, validator: AttributeTypes.Validator<T>, attr, path: AttributePath) : T[] {
    var ret: T[] = [];
    path.push("[", "", "]");
    if (Array.isArray(attr)) {
      for (var idx = 0, attrlen = attr.length; idx < attrlen; idx++) {
        var value = validator(reporter, path.set(idx.toString(), -3), attr[idx]);
        if (value !== undefined)
          ret.push(value);
      }
    }
    else {
      reporter.diagnostic({ type: "warning", msg: `attribute ${path.toString()} must be an array`});
    }
    path.pop(3);
    return ret;
  }

  export class ListResolver<T> implements Resolver<T[]> {
    validator: AttributeTypes.Validator<T>;
    
    constructor(validator: AttributeTypes.Validator<T>) {
      this.validator = validator;
    }
    
    resolve(reporter: Reporter, attr, path: AttributePath) : T[] {
      return listResolve(reporter, this.validator, attr, path);
    }
  }

  export class ByEnvListResolver<T> implements Resolver<{ [s:string]: T[] }> {
    validator: AttributeTypes.Validator<T>;
    
    constructor(validator: AttributeTypes.Validator<T>) {
      this.validator = validator;
    }
    
    resolve(reporter: Reporter, attr, path: AttributePath) : { [s:string]: T[] } {
      var ret: { [s:string]: T[] } = {};
      if (typeof attr === "object") {
        path.push("");
        for (var k in attr) {
          ret[k] = listResolve(reporter, this.validator, attr[k], path.set(k));
        }
        path.pop();
      }
      else {
        reporter.diagnostic({ type: "warning", msg: `attribute ${path.toString()} must be an array`});
      }
      return ret;
    }
  }

  export var stringListResolver = new ListResolver(AttributeTypes.validateString);
  /*
  export class SimpleResolver extends Resolver {
    map: MapValue;
    defaultValue: any;
    extensions: {path: string, map: MapValue, default: any}[];
    
    constructor(options: {
      path: string,
      map?: MapValue,
      extensions?: {path: string, map: MapValue, default: any}[],
      defaultValue?: any;
    }) {
      super(options);
      this.map = options.map || AttributeTypes.validateString;
      this.extensions = options.extensions;
      this.defaultValue = options.defaultValue;
    }
    
    resolve(reporter: Reporter, target: Target, task?: Task, lvl?: number) {
      var ret = undefined;
      var attr: any = target.attributes[this.path];
      if (attr !== undefined) {
        if (typeof attr === "object" && attr.value) {
          var path = new AttributePath(this.path);
          ret= this.map(reporter, path, attr.value, target, task, lvl);
          path.push("[", "", "]");
          if (this.extensions) {
            var base = {};
            for (var i = 0, len = this.extensions.length; i < len; i++) {
              var ext = this.extensions[i];
              var v = attr[ext.path];
              if (v !== undefined) {
                path.set(ext.path, -2);
                base[ext.path] = ext.map(reporter, path, v, target, task, lvl);
              }
              else {
                base[ext.path] = ext.default;
              }
            }
          }
        }
        else {
          ret= this.map(reporter, new AttributePath(this.path), attr, target, task, lvl);
        }
      }
      else if (this.defaultValue !== undefined)
        ret= this.defaultValue;
      else
        reporter.diagnostic({ type: "warning", msg: `attribute ${this.path} is required`});
      return ret;
    }
  }
  
  
  
  export class TaskListResolver extends ListResolver {
    passComplexValueConditions(reporter: Reporter, path: AttributePath, value: any, target: Target, task?: Task, lvl?: number) : boolean {
      return this.safeCall(reporter, value.ifTarget, "(target: Target) => boolean", true, path, target)
          && this.safeCall(reporter, value.ifTask, "(task: Task, target: Target) => boolean", true, path, target);
    }
  }*/
}

export class AttributePath {
  path: string[];
  
  constructor(path?: string) {
    this.path = path !== void 0 ? [path] : [];
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
