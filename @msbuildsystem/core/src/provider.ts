import {Target, SelfBuildGraph, Reporter, AttributePath, AttributeTypes, Diagnostic} from "./index.priv";

export interface ProviderList<CSTOR, C> {
  list: CSTOR[];
  register: (constructor: CSTOR) => void;
  unregister: (constructor: CSTOR) => void;
  find: (conditions: C) => CSTOR[];
  validate: (reporter: Reporter, path: AttributePath, value: any) => CSTOR | undefined;
}

export function createProviderList<
  CSTOR extends { name: string, isCompatible(conditions: C) },
  C extends { [s: string]: any }
  >(type: string) : ProviderList<CSTOR, C> {
  let list = <CSTOR[]>[];
  function register(constructor: CSTOR) {
    list.push(constructor);
  }
  function unregister(constructor: CSTOR) {
    let idx = list.indexOf(constructor);
    if (idx !== -1)
      list.splice(idx, 1);
  }
  function find(conditions: C) {
    return list.filter(l => l.isCompatible(conditions));
  }
  function validate(reporter: Reporter, path: AttributePath, value: C) : CSTOR | undefined {
    let builders = find(value);
    if (builders.length === 1)
      return builders[0];
    else if (builders.length === 0)
      path.diagnostic(reporter, {
        type: "error",
        msg: `unable to find ${type}`,
        notes: [<Diagnostic>{ type: "note", msg: `while looking for ${type}: ${value}` }]
          .concat(list.map(s => (<Diagnostic>{
            type: "note",
            msg: `found: ${s.name}`
          })))
      });
    else
      path.diagnostic(reporter, {
        type: "error",
        msg: `multiple ${type}s found`,
        notes: [<Diagnostic>{ type: "note", msg: `while looking for sysroot: ${value}` }]
          .concat(list.map(s => (<Diagnostic>{
            type: "note",
            msg: `found: ${s.name}`
          })))
      });
    return undefined;
  }
  return {
    list: list,
    register: register,
    unregister: unregister,
    find: find,
    validate: validate
  };
}

export function createCachedProviderList<
  CSTOR extends { name: string, isCompatible(conditions: C) },
  C extends { [s: string]: any }
  >(type: string) : ProviderList<CSTOR, C> & { isOutOfDate: boolean } {
  let r = <ProviderList<CSTOR, C> & { isOutOfDate: boolean }>createProviderList<CSTOR, C>(type);
  r.isOutOfDate = true;
  return r;
}
export function createBuildGraphProviderList<P extends Target, T extends SelfBuildGraph<P>>(type: string, defaultCstor?: { new (graph: P) : T }) {
  let list = new Map<string, { new (graph: P) : T }>();
  function declareBuildGraphProvider(names: string[]) {
    return function (constructor: { new (graph: P) : T }) {
      names.forEach(name => {
        list.set(name, constructor);
      });
    };
  }
  function find(name: string) {
    return list.get(name);
  }
  function validate(reporter: Reporter, path: AttributePath, value: any, target: P) : T | undefined {
    if (value === undefined && defaultCstor !== undefined)
      return new defaultCstor(target);
    let v = AttributeTypes.validateString(reporter, path, value);
    let ret: T | undefined = undefined;
    if (v !== undefined) {
      let builder = find(v);
      if (builder !== undefined) {
        ret = new builder(target);
        ret.resolve(reporter, target);
      }
      else
        reporter.diagnostic({ type: "error", msg: `unable to find ${type}`});
    }
    return ret;
  }
  return {
    list: list,
    declare: declareBuildGraphProvider,
    find: find,
    validate: validate
  };
}
