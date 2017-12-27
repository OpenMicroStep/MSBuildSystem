import {Reporter, PathReporter} from './index';

export type Traverse<V> = V & { traverse(lvl: number, context: object) : any };
export type Validator    <T, A0> = { validate(at: PathReporter, value: any, a0: A0) : T | undefined };
export type Validator0   <T    > = { validate(at: PathReporter, value: any        ) : T | undefined };
export type ValidatorNU  <T, A0> = { validate(at: PathReporter, value: any, a0: A0) : T };
export type ValidatorNU0 <T    > = { validate(at: PathReporter, value: any        ) : T };
export type ValidatorT   <T, A0> = Traverse<Validator<T, A0>  >;
export type ValidatorT0  <T    > = Traverse<Validator0<T>     >;
export type ValidatorTNU <T, A0> = Traverse<ValidatorNU<T, A0>>;
export type ValidatorTNU0<T    > = Traverse<ValidatorNU0<T>   >;
export type Extension    <T, A0> = (Validator <T, A0> | ValidatorNU <T, A0>) & { doc?: string };
export type Extension0   <T    > = (Validator0<T    > | ValidatorNU0<T    >) & { doc?: string };
export type Extensions   <T, A0> = { [K in keyof T]: Extension <T[K], A0> };
export type Extensions0  <T    > = { [K in keyof T]: Extension0<T[K]    > };
export type ExtensionsNU <T, A0> = { [K in keyof T]: Extension <T[K], A0>  };
export type ExtensionT   <T, A0> = (ValidatorT <T, A0> | ValidatorTNU <T | undefined, A0>) & { doc?: string };
export type Extension0T  <T    > = (ValidatorT0<T    > | ValidatorTNU0<T | undefined    >) & { doc?: string };
export type ExtensionsT  <T, A0> = { [K in keyof T]: ExtensionT <T[K], A0> };
export type Extensions0T <T    > = { [K in keyof T]: Extension0T<T[K]    > };
export type Reducer<T, R, C extends {}> = (at: PathReporter, current: T, previous: R | undefined, context: C) => R;

export function superValidateList<T, A0> (
  at: PathReporter, attr: T[], a0: A0,
  validator: Validator<T, A0>, push: (T) => void
) {
  if (Array.isArray(attr)) {
    at.pushArray();
    for (var idx = 0, attrlen = attr.length; idx < attrlen; idx++) {
      var value = validator.validate(at.setArrayKey(idx), attr[idx], a0);
      if (value !== undefined)
        push(value);
    }
    at.popArray();
  }
  else {
    at.diagnostic({ is: "warning", msg: `attribute must be an array`});
  }
}

export function superFill<T, A0>(
  at: PathReporter, attr: any, a0: A0,
  into: T, extensions: Extensions<T, A0>
) : T {
  at.pushArray();
  for (var k in extensions) {
    var ext = extensions[k];
    var v = attr[k];
    at.setArrayKey(k);
    v = ext.validate(at, v, a0);
    into[k] = v;
  }
  at.popArray();
  return into;
}

export function superValidateObject<T, A0>(
  at: PathReporter, attr: any, a0: A0,
  into: T, extensions: Extensions<T, A0>) : T;
export function superValidateObject<T, K, A0>(
  at: PathReporter, attr: any, a0: A0,
  into: T & { [s: string]: K }, extensions: Extensions<T, A0>, objectForKeyValidator?: Validator<K, string>
) : T & { [s: string]: K };
export function superValidateObject<T, K, A0>(
  at: PathReporter, attr: any, a0: A0,
  into: T & { [s: string]: K }, extensions: Extensions<T, A0>, objectForKeyValidator?: Validator<K, string>
) : T & { [s: string]: K } {
  at.push('.', '');
  if (typeof attr !== "object") {
    at.diagnostic({ is: "warning", msg: `attribute must be a object, got ${typeof attr}`});
    attr = {};
  }
  let k;
  for (k in extensions) { // insert all extensions first
    into[k] = extensions[k].validate(at.set(k), attr[k], a0) as any;
  }
  for (k in attr as T) {
    if (!(k in extensions)) {
      at.set(k);
      if (objectForKeyValidator) {
        let v = objectForKeyValidator.validate(at, attr[k], k);
        if (v !== undefined)
          into[k] = v;
      }
      else {
        at.diagnostic({ is: "warning", msg: `attribute is unused` });
      }
    }
  }
  at.pop(2);
  return into;
}

export const validateAny: Traverse<Validator0<any>> = {
  validate: function validateAny(at: PathReporter, value: any) {
    return value;
  },
  traverse() {
    return `any value`;
  }
};

export const validateAnyToUndefined: Traverse<Validator0<undefined>> = {
  validate: function validateAnyToUndefined(at: PathReporter, value: any) {
    return undefined;
  },
  traverse() {
    return `any value to undefined`;
  }
};

export const validateObject: Traverse<Validator0<object>> = {
  validate: function validateObject(at: PathReporter, value: any) {
    if (typeof value !== "object")
      at.diagnostic({ is: "warning", msg: `attribute must be an object, got ${typeof value}`});
    else
      return value;
    return undefined;
  },
  traverse() {
    return `object`;
  }
};
export const validateArray: Traverse<Validator0<any[]>> = {
  validate: function validateArray(at: PathReporter, value: any) {
    if (!Array.isArray(value))
      at.diagnostic({ is: "warning", msg: `attribute must be an array`});
    else
      return value;
    return [];
  },
  traverse() {
    return `array`;
  }
};
export const validateString: Traverse<Validator0<string>> = {
  validate: function validateString(at: PathReporter, value: any) {
    if (typeof value !== "string")
      at.diagnostic({ is: "warning", msg: `attribute must be a string, got ${typeof value}`});
    else if (value.length === 0)
      at.diagnostic({ is: "warning", msg: `attribute can't be an empty string`});
    else
      return value;
    return undefined;
  },
  traverse() {
    return `non empty string`;
  }
};
export const validateAnyString: Traverse<Validator0<string>> = {
  validate: function validateString(at: PathReporter, value: any) {
    if (typeof value !== "string")
      at.diagnostic({ is: "warning", msg: `attribute must be a string, got ${typeof value}`});
    else
      return value;
    return undefined;
  },
  traverse() {
    return `a string`;
  }
};

export const validateBoolean: Traverse<Validator0<boolean>> = {
  validate: function validateBoolean(at: PathReporter, value: any) {
    if (typeof value !== "boolean")
      at.diagnostic({ is: "warning", msg: `attribute must be a boolean, got ${typeof value}`});
    else
      return value;
    return undefined;
  },
  traverse() {
    return `boolean`;
  }
};

export function chain<T0>(v0: Validator0<T0>) : Validator0<T0>;
export function chain<T0>(v0: Validator0<any>, v1: Validator0<T0>) : Validator0<T0>;
export function chain<T0>(v0: Validator0<any>, v1: Validator0<any>, v2: Validator0<T0>) : Validator0<T0>;
export function chain<T0>(v0: Validator0<any>, v1: Validator0<any>, v2: Validator0<any>, v3: Validator0<T0>) : Validator0<T0>;
export function chain(...validators: Validator0<any>[]) : Validator0<any>;
export function chain<T0, A0>(v0: Validator<T0, A0>) : Validator<T0, A0>;
export function chain<T0, A0>(v0: Validator<any, A0>, v1: Validator<T0, A0>) : Validator<T0, A0>;
export function chain<T0, A0>(v0: Validator<any, A0>, v1: Validator<any, A0>, v2: Validator<T0, A0>) : Validator<T0, A0>;
export function chain<T0, A0>(v0: Validator<any, A0>, v1: Validator<any, A0>, v2: Validator<any, A0>, v3: Validator<T0, A0>) : Validator<T0, A0>;
export function chain<A0>(...validators: Validator<any, A0>[]) : Validator<any, A0>;
export function chain<A0>(v0: Validator<any, A0>, ...validators: Validator<any, A0>[]) {
  function validateChain(at: PathReporter, value, a0: A0) {
    let i = 0;
    value = v0.validate(at, value, a0);
    for (; value !== undefined && i < validators.length; i++)
      value = validators[i].validate(at, value, a0);
    return value;
  }
  return { validate: validateChain };
}

export function oneOf<T0>(v0: Validator0<T0>) : Validator0<T0>;
export function oneOf<T0, T1>(v0: Validator0<T0>, v1: Validator0<T1>) : Validator0<T0 | T1>;
export function oneOf<T0, T1, T2>(v0: Validator0<T0>, v1: Validator0<T1>, v2: Validator0<T2>) : Validator0<T0 | T1 | T2>;
export function oneOf<T0, T1, T2, T3>(v0: Validator0<T0>, v1: Validator0<T1>, v2: Validator0<T2>, v3: Validator0<T3>) : Validator0<T0 | T1 | T2 | T3>;
export function oneOf(...validators: Validator0<any>[]) : Validator0<any>;
export function oneOf<T0, A0>(v0: Validator<T0, A0>) : Validator<T0, A0>;
export function oneOf<T0, T1, A0>(v0: Validator<T0, A0>, v1: Validator<T1, A0>) : Validator<T0 | T1, A0>;
export function oneOf<T0, T1, T2, A0>(v0: Validator<T0, A0>, v1: Validator<T1, A0>, v2: Validator<T2, A0>) : Validator<T0 | T1 | T2, A0>;
export function oneOf<T0, T1, T2, T3, A0>(v0: Validator<T0, A0>, v1: Validator<T1, A0>, v2: Validator<T2, A0>, v3: Validator<T3, A0>) : Validator<T0 | T1 | T2 | T3, A0>;
export function oneOf<A0>(...validators: Validator<any, A0>[]) : Validator<any, A0>;
export function oneOf<A0>(v0: Validator<any, A0>, ...validators: Validator<any, A0>[]) {
  function validateOneOf(at: PathReporter, value, a0: A0) {
    let s0 = at.reporter.snapshot();
    let si = s0;
    let rvalue = v0.validate(at, value, a0);
    for (let i = 0; at.reporter.hasChanged(si) && i < validators.length; i++) {
      si = at.reporter.snapshot();
      rvalue = validators[i].validate(at, value, a0);
    }
    if (!at.reporter.hasChanged(si)) {
      at.reporter.rollback(s0); // value is value, rollback all diagnostics
      return rvalue;
    }
    else {
      let diags = at.reporter.diagnosticsAfter(s0);
      at.reporter.rollback(s0);
      at.diagnostic({
        is: "warning",
        msg: `attribute must be one of`,
        notes: diags,
      });
    }
    return undefined;
  }
  return { validate: validateOneOf };
}

export function defaultsTo<T    >(validator: Traverse<Validator0  <T    >>, defaultValue: undefined, doc?: string) : Traverse<Validator0<T    >>;
export function defaultsTo<T, A0>(validator: Traverse<Validator   <T, A0>>, defaultValue: undefined, doc?: string) : Traverse<Validator <T, A0>>;
export function defaultsTo<T    >(validator: Traverse<ValidatorNU0<T    >>, defaultValue: undefined, doc?: string) : Traverse<Validator0<T    >>;
export function defaultsTo<T, A0>(validator: Traverse<ValidatorNU <T, A0>>, defaultValue: undefined, doc?: string) : Traverse<Validator <T, A0>>;
export function defaultsTo<T    >(validator: Traverse<Validator0  <T    >>, defaultValue: T, doc?: string) : Traverse<ValidatorNU0<T    >>;
export function defaultsTo<T, A0>(validator: Traverse<Validator   <T, A0>>, defaultValue: T, doc?: string) : Traverse<ValidatorNU <T, A0>>;
export function defaultsTo<T    >(validator: Traverse<ValidatorNU0<T    >>, defaultValue: T, doc?: string) : Traverse<ValidatorNU0<T    >>;
export function defaultsTo<T, A0>(validator: Traverse<ValidatorNU <T, A0>>, defaultValue: T, doc?: string) : Traverse<ValidatorNU <T, A0>>;
export function defaultsTo<T    >(validator: Traverse<Validator0  <T    >>, defaultValue: (  ) => T, doc: string) : Traverse<ValidatorNU0<T    >>;
export function defaultsTo<T, A0>(validator: Traverse<Validator   <T, A0>>, defaultValue: (a0) => T, doc: string) : Traverse<ValidatorNU <T, A0>>;
export function defaultsTo<T    >(validator: Traverse<ValidatorNU0<T    >>, defaultValue: (  ) => T, doc: string) : Traverse<ValidatorNU0<T    >>;
export function defaultsTo<T, A0>(validator: Traverse<ValidatorNU <T, A0>>, defaultValue: (a0) => T, doc: string) : Traverse<ValidatorNU <T, A0>>;
export function defaultsTo<T, A0>(validator: Traverse<Validator   <T, A0>>, defaultValue: T | ((a0) => T), doc?: string) : Traverse<ValidatorNU <T, A0>> {
  function validateWithDefaultValue(at: PathReporter, value, a0: A0) {
    if (value === undefined || (value = validator.validate(at, value, a0)) === undefined)
      return typeof defaultValue === "function" ? defaultValue(a0) : defaultValue;
    return value;
  }
  return {
    validate: validateWithDefaultValue,
    traverse(lvl, context) {
      return `${validator.traverse(lvl, context)}, defaults to ${doc || (defaultValue instanceof Object ? defaultValue.constructor.name : defaultValue)}`;
    }
  };
}

export function fallbackTo<T    >(validator: Traverse<Validator0  <T    >>, defaultValue: undefined) : Traverse<Validator0<T    >>;
export function fallbackTo<T, A0>(validator: Traverse<Validator   <T, A0>>, defaultValue: undefined) : Traverse<Validator <T, A0>>;
export function fallbackTo<T    >(validator: Traverse<ValidatorNU0<T    >>, defaultValue: undefined) : Traverse<Validator0<T    >>;
export function fallbackTo<T, A0>(validator: Traverse<ValidatorNU <T, A0>>, defaultValue: undefined) : Traverse<Validator <T, A0>>;
export function fallbackTo<T    >(validator: Traverse<Validator0  <T    >>, defaultValue: T) : Traverse<ValidatorNU0<T    >>;
export function fallbackTo<T, A0>(validator: Traverse<Validator   <T, A0>>, defaultValue: T) : Traverse<ValidatorNU <T, A0>>;
export function fallbackTo<T    >(validator: Traverse<ValidatorNU0<T    >>, defaultValue: T) : Traverse<ValidatorNU0<T    >>;
export function fallbackTo<T, A0>(validator: Traverse<ValidatorNU <T, A0>>, defaultValue: T) : Traverse<ValidatorNU <T, A0>>;
export function fallbackTo<T    >(validator: Traverse<Validator0  <T    >>, defaultValue: (  ) => T) : Traverse<ValidatorNU0<T    >>;
export function fallbackTo<T, A0>(validator: Traverse<Validator   <T, A0>>, defaultValue: (a0) => T) : Traverse<ValidatorNU <T, A0>>;
export function fallbackTo<T    >(validator: Traverse<ValidatorNU0<T    >>, defaultValue: (  ) => T) : Traverse<ValidatorNU0<T    >>;
export function fallbackTo<T, A0>(validator: Traverse<ValidatorNU <T, A0>>, defaultValue: (a0) => T) : Traverse<ValidatorNU <T, A0>>;
export function fallbackTo<T, A0>(validator: Traverse<Validator   <T, A0>>, defaultValue: T | ((a0) => T)) : Traverse<ValidatorNU <T, A0>> {
  function validateWithFallbackValue(at: PathReporter, value, a0: A0) {
    if ((value = validator.validate(at, value, a0)) === undefined)
      return typeof defaultValue === "function" ? defaultValue(a0) : defaultValue;
    return value;
  }
  return {
    validate: validateWithFallbackValue,
    traverse(lvl, context) {
      return `${validator.traverse(lvl, context)}`;
    }
  };
}

export function functionValidator<A0>(prototype: string) : Validator<void, A0> {
  function validateFunction(at: PathReporter, value, a0: A0) {
    AttributeUtil.safeCall(at, value, prototype, null, a0);
  }
  return { validate: validateFunction };
}

export function listValidator<T>(validator: Validator0<T>) : ValidatorNU0<T[]>;
export function listValidator<T, A0>(validator: Validator<T, A0>) : ValidatorNU<T[], A0>;
export function listValidator<T, A0>(validator: Validator<T, A0>) {
  function validateList(at: PathReporter, attr, a0: A0) : T[] {
    let ret = [];
    superValidateList(at, attr, a0, validator, ret.push.bind(ret));
    return ret;
  };
  return { validate: validateList };
}

export function objectValidator<T       >(extensions: Extensions0<T    >) : ValidatorNU0<T>;
export function objectValidator<T   , A0>(extensions: Extensions <T, A0>) : ValidatorNU <T, A0>;
export function objectValidator<T       >(extensions: Extensions0<T   > , objectForKeyValidator: Validator<undefined, string>) : ValidatorNU0<T>;
export function objectValidator<T   , A0>(extensions: Extensions <T, A0>, objectForKeyValidator: Validator<undefined, string>) : ValidatorNU <T, A0>;
export function objectValidator<T, K    >(extensions: Extensions0<T   > , objectForKeyValidator: Validator<K        , string>) : ValidatorNU0<T & { [s: string]: K }>;
export function objectValidator<T, K, A0>(extensions: Extensions <T, A0>, objectForKeyValidator: Validator<K        , string>) : ValidatorNU <T & { [s: string]: K }, A0>;
export function objectValidator<T, K, A0>(extensions: Extensions <T, A0>, objectForKeyValidator?: Validator<K, string>) {
  function validateObject(at: PathReporter, attr, a0: A0) : T & { [s: string]: K } {
    var ret = <T & { [s: string]: K }>{};
    superValidateObject(at, attr, a0, ret, extensions, objectForKeyValidator);
    return ret;
  };
  return { validate: validateObject };
}

export function setValidator<T>(validator: Validator0<T>) : ValidatorNU0<Set<T>>;
export function setValidator<T, A0>(validator: Validator<T, A0>) : ValidatorNU<Set<T>, A0>;
export function setValidator<T, A0>(validator: Validator<T, A0>) {
  function validateSet(at: PathReporter, attr, a0: A0) : Set<T> {
    let ret = new Set<T>();
    superValidateList(at, attr, a0, validator, function(value) {
      ret.add(value);
    });
    return ret;
  };
  return { validate: validateSet };
}

export function reducedListValidator<T, R, C>(validator: Validator0<T>, reduce: Reducer<T, R, C>) : Validator0<R>;
export function reducedListValidator<T, R, C, A0>(validator: Validator<T, A0>, reduce: Reducer<T, R, C>) : Validator<R, A0>;
export function reducedListValidator<T, R, C, A0>(validator: Validator<T, A0>, reduce: Reducer<T, R, C>) {
  function validateReducedList(at: PathReporter, attr, a0: A0) : R | undefined {
    let previous: R | undefined = undefined;
    let context = {};
    superValidateList(at, attr, a0, validator, (value) => {
      previous = reduce(at, value, previous, <C>context);
    });
    return previous;
  };
  return { validate: validateReducedList };
}

export function createReduceByMergingObjects({ allowMultipleValues }) {
  return function reduceByMergingObjects(at: PathReporter, current: object, previous: object | undefined,
    context: { keysWithSimpleValue?: Set<string>, subContexts?: Map<Object, Object> }) : object {
    if (previous === undefined)
      previous = {};
    if (!context.keysWithSimpleValue)
      context.keysWithSimpleValue = new Set();
    at.push('.', '');
    for (var key in current as any) { // TODO: remove cast to any once tsc 2.3 is released (https://github.com/Microsoft/TypeScript/pull/14195)
      var cvalue = previous[key];
      var dvalue = current[key];
      var cvalueIsArr = cvalue ? Array.isArray(cvalue) : false;
      var dvalueIsArr = dvalue ? Array.isArray(dvalue) : false;
      var cvalueIsObj = typeof cvalue === "object";
      var dvalueIsObj = typeof dvalue === "object";
      if (cvalue === dvalue) {}
      else if (cvalue !== undefined && (cvalueIsArr !== dvalueIsArr || cvalueIsObj !== dvalueIsObj)) {
        at.set(key).diagnostic({
          is: "warning",
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
        reduceByMergingObjects(at, dvalue, cvalue, subcontext);
      }
      else if (context.keysWithSimpleValue.has(key)) {
        at.set(key).diagnostic({
          is: "warning",
          msg: `attribute value is incoherent for injection, attribute is removed`
        });
      }
      else if (cvalue === undefined) {
        context.keysWithSimpleValue.add(key);
        previous[key] = dvalue;
      }
    }
    at.pop(2);
    return previous;
  };
}
export const validateStringList: ValidatorTNU0<string[]> = { ...listValidator(validateString), traverse: () => 'string list' };
export const validateStringSet: ValidatorTNU0<Set<string>> = { ...setValidator(validateString), traverse: () => 'string list' };

export module AttributeUtil {
  export function safeCall(at: PathReporter, fn: Function, signature: string, defaultReturnValue: any, ...args) {
    if (!fn) return defaultReturnValue;

    if (typeof fn !== "function") {
      at.diagnostic({
        is: "error",
        msg: `attribute must be a function with signature ${signature}`
      });
    }
    else {
      try {
        return fn(...args);
      } catch (e) {
        at.reporter.error(e, {
          is: "error",
          msg: `attribute must be a function with signature ${signature}`,
          path: at.toString(),
        });
      }
    }
    return defaultReturnValue;
  }
}
