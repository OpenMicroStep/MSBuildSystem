import {Reporter, AttributePath} from './index';

export type Traverse<V> = V & { traverse(lvl: number, context: object) : any };
export type Validator    <T, A0> = { validate(reporter: Reporter, path: AttributePath, value: any, a0: A0) : T | undefined };
export type Validator0   <T    > = { validate(reporter: Reporter, path: AttributePath, value: any        ) : T | undefined };
export type ValidatorNU  <T, A0> = { validate(reporter: Reporter, path: AttributePath, value: any, a0: A0) : T };
export type ValidatorNU0 <T    > = { validate(reporter: Reporter, path: AttributePath, value: any        ) : T };
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
export type Reducer<T, R, C extends {}> = (reporter: Reporter, path: AttributePath, current: T, previous: R | undefined, context: C) => R;

export function superValidateList<T, A0> (
  reporter: Reporter, path: AttributePath, attr: T[], a0: A0,
  validator: Validator<T, A0>, push: (T) => void
) {
  if (Array.isArray(attr)) {
    path.pushArray();
    for (var idx = 0, attrlen = attr.length; idx < attrlen; idx++) {
      var value = validator.validate(reporter, path.setArrayKey(idx), attr[idx], a0);
      if (value !== undefined)
        push(value);
    }
    path.popArray();
  }
  else {
    path.diagnostic(reporter, { type: "warning", msg: `attribute must be an array`});
  }
}

export function superFill<T, A0>(
  reporter: Reporter, path: AttributePath, attr: any, a0: A0,
  into: T, extensions: Extensions<T, A0>
) : T {
  path.pushArray();
  for (var k in extensions) {
    var ext = extensions[k];
    var v = attr[k];
    path.setArrayKey(k);
    v = ext.validate(reporter, path, v, a0);
    into[k] = v;
  }
  path.popArray();
  return into;
}

export function superValidateObject<T, A0>(
  reporter: Reporter, path: AttributePath, attr: any, a0: A0,
  into: T, extensions: Extensions<T, A0>) : T;
export function superValidateObject<T, K, A0>(
  reporter: Reporter, path: AttributePath, attr: any, a0: A0,
  into: T & { [s: string]: K }, extensions: Extensions<T, A0>, objectForKeyValidator?: Validator<K, string>
) : T & { [s: string]: K };
export function superValidateObject<T, K, A0>(
  reporter: Reporter, at: AttributePath, attr: any, a0: A0,
  into: T & { [s: string]: K }, extensions: Extensions<T, A0>, objectForKeyValidator?: Validator<K, string>
) : T & { [s: string]: K } {
  at.push('.', '');
  if (typeof attr !== "object") {
    at.diagnostic(reporter, { type: "warning", msg: `attribute must be a object, got ${typeof attr}`});
    attr = {};
  }
  let k;
  for (k in extensions) { // insert all extensions first
    into[k] = extensions[k].validate(reporter, at.set(k), attr[k], a0) as any;
  }
  for (k in attr as T) {
    if (!(k in extensions)) {
      at.set(k);
      if (objectForKeyValidator) {
        let v = objectForKeyValidator.validate(reporter, at, attr[k], k);
        if (v !== undefined)
          into[k] = v;
      }
      else {
        at.diagnostic(reporter, { type: "warning", msg: `attribute is unused` });
      }
    }
  }
  at.pop(2);
  return into;
}

export const validateAny: Traverse<Validator0<any>> = {
  validate: function validateAny(reporter: Reporter, path: AttributePath, value: any) {
    return value;
  },
  traverse() {
    return `any value`;
  }
};

export const validateAnyToUndefined: Traverse<Validator0<undefined>> = {
  validate: function validateAnyToUndefined(reporter: Reporter, path: AttributePath, value: any) {
    return undefined;
  },
  traverse() {
    return `any value to undefined`;
  }
};

export const validateObject: Traverse<Validator0<object>> = {
  validate: function validateObject(reporter: Reporter, path: AttributePath, value: any) {
    if (typeof value !== "object")
      path.diagnostic(reporter, { type: "warning", msg: `attribute must be an object, got ${typeof value}`});
    else
      return value;
    return undefined;
  },
  traverse() {
    return `object`;
  }
};
export const validateArray: Traverse<Validator0<any[]>> = {
  validate: function validateArray(reporter: Reporter, path: AttributePath, value: any) {
    if (!Array.isArray(value))
      path.diagnostic(reporter, { type: "warning", msg: `attribute must be an array`});
    else
      return value;
    return [];
  },
  traverse() {
    return `array`;
  }
};
export const validateString: Traverse<Validator0<string>> = {
  validate: function validateString(reporter: Reporter, path: AttributePath, value: any) {
    if (typeof value !== "string")
      path.diagnostic(reporter, { type: "warning", msg: `attribute must be a string, got ${typeof value}`});
    else if (value.length === 0)
      path.diagnostic(reporter, { type: "warning", msg: `attribute can't be an empty string`});
    else
      return value;
    return undefined;
  },
  traverse() {
    return `non empty string`;
  }
};
export const validateAnyString: Traverse<Validator0<string>> = {
  validate: function validateString(reporter: Reporter, path: AttributePath, value: any) {
    if (typeof value !== "string")
      path.diagnostic(reporter, { type: "warning", msg: `attribute must be a string, got ${typeof value}`});
    else
      return value;
    return undefined;
  },
  traverse() {
    return `a string`;
  }
};

export const validateBoolean: Traverse<Validator0<boolean>> = {
  validate: function validateBoolean(reporter: Reporter, path: AttributePath, value: any) {
    if (typeof value !== "boolean")
      path.diagnostic(reporter, { type: "warning", msg: `attribute must be a boolean, got ${typeof value}`});
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
  function validateChain(reporter, path: AttributePath, value, a0: A0) {
    let i = 0;
    value = v0.validate(reporter, path, value, a0);
    for (; value !== undefined && i < validators.length; i++)
      value = validators[i].validate(reporter, path, value, a0);
    return value;
  }
  return { validate: validateChain };
}
export function defaultsTo<T    >(validator: Traverse<Validator0  <T    >>, defaultValue: undefined) : Traverse<Validator0<T    >>;
export function defaultsTo<T, A0>(validator: Traverse<Validator   <T, A0>>, defaultValue: undefined) : Traverse<Validator <T, A0>>;
export function defaultsTo<T    >(validator: Traverse<ValidatorNU0<T    >>, defaultValue: undefined) : Traverse<Validator0<T    >>;
export function defaultsTo<T, A0>(validator: Traverse<ValidatorNU <T, A0>>, defaultValue: undefined) : Traverse<Validator <T, A0>>;
export function defaultsTo<T    >(validator: Traverse<Validator0  <T    >>, defaultValue: T) : Traverse<ValidatorNU0<T    >>;
export function defaultsTo<T, A0>(validator: Traverse<Validator   <T, A0>>, defaultValue: T) : Traverse<ValidatorNU <T, A0>>;
export function defaultsTo<T    >(validator: Traverse<ValidatorNU0<T    >>, defaultValue: T) : Traverse<ValidatorNU0<T    >>;
export function defaultsTo<T, A0>(validator: Traverse<ValidatorNU <T, A0>>, defaultValue: T) : Traverse<ValidatorNU <T, A0>>;
export function defaultsTo<T    >(validator: Traverse<Validator0  <T    >>, defaultValue: (  ) => T, doc: string) : Traverse<ValidatorNU0<T    >>;
export function defaultsTo<T, A0>(validator: Traverse<Validator   <T, A0>>, defaultValue: (a0) => T, doc: string) : Traverse<ValidatorNU <T, A0>>;
export function defaultsTo<T    >(validator: Traverse<ValidatorNU0<T    >>, defaultValue: (  ) => T, doc: string) : Traverse<ValidatorNU0<T    >>;
export function defaultsTo<T, A0>(validator: Traverse<ValidatorNU <T, A0>>, defaultValue: (a0) => T, doc: string) : Traverse<ValidatorNU <T, A0>>;
export function defaultsTo<T, A0>(validator: Traverse<Validator   <T, A0>>, defaultValue: T | ((a0) => T), doc?: string) : Traverse<ValidatorNU <T, A0>> {
  function validateWithDefaultValue(reporter, path: AttributePath, value, a0: A0) {
    if (value === undefined || (value = validator.validate(reporter, path, value, a0)) === undefined)
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
  function validateWithFallbackValue(reporter, path: AttributePath, value, a0: A0) {
    if ((value = validator.validate(reporter, path, value, a0)) === undefined)
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
  function validateFunction(reporter, path: AttributePath, value, a0: A0) {
    AttributeUtil.safeCall(reporter, value, prototype, null, path, a0);
  }
  return { validate: validateFunction };
}

export function listValidator<T>(validator: Validator0<T>) : ValidatorNU0<T[]>;
export function listValidator<T, A0>(validator: Validator<T, A0>) : ValidatorNU<T[], A0>;
export function listValidator<T, A0>(validator: Validator<T, A0>) {
  function validateList(reporter: Reporter, path: AttributePath, attr, a0: A0) : T[] {
    let ret = [];
    superValidateList(reporter, path, attr, a0, validator, ret.push.bind(ret));
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
  function validateObject(reporter: Reporter, path: AttributePath, attr, a0: A0) : T & { [s: string]: K } {
    var ret = <T & { [s: string]: K }>{};
    superValidateObject(reporter, path, attr, a0, ret, extensions, objectForKeyValidator);
    return ret;
  };
  return { validate: validateObject };
}

export function setValidator<T>(validator: Validator0<T>) : ValidatorNU0<Set<T>>;
export function setValidator<T, A0>(validator: Validator<T, A0>) : ValidatorNU<Set<T>, A0>;
export function setValidator<T, A0>(validator: Validator<T, A0>) {
  function validateSet(reporter: Reporter, path: AttributePath, attr, a0: A0) : Set<T> {
    let ret = new Set<T>();
    superValidateList(reporter, path, attr, a0, validator, function(value) {
      ret.add(value);
    });
    return ret;
  };
  return { validate: validateSet };
}

export function reducedListValidator<T, R, C>(validator: Validator0<T>, reduce: Reducer<T, R, C>) : Validator0<R>;
export function reducedListValidator<T, R, C, A0>(validator: Validator<T, A0>, reduce: Reducer<T, R, C>) : Validator<R, A0>;
export function reducedListValidator<T, R, C, A0>(validator: Validator<T, A0>, reduce: Reducer<T, R, C>) {
  function validateReducedList(reporter: Reporter, path: AttributePath, attr, a0: A0) : R | undefined {
    let previous: R | undefined = undefined;
    let context = {};
    superValidateList(reporter, path, attr, a0, validator, (value) => {
      previous = reduce(reporter, path, value, previous, <C>context);
    });
    return previous;
  };
  return { validate: validateReducedList };
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
export const validateStringList: ValidatorTNU0<string[]> = { ...listValidator(validateString), traverse: () => 'string list' };
export const validateStringSet: ValidatorTNU0<Set<string>> = { ...setValidator(validateString), traverse: () => 'string list' };

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
