import {Reporter, AttributePath, Diagnostic, AttributeTypes as V, util} from "./index";

export interface ProviderList<CSTOR, C> {
  list: CSTOR[];
  register(constructor: CSTOR) : void;
  unregister(constructor: CSTOR) : void;
  find(conditions: C) : CSTOR[];
  findBest(conditions: C) : CSTOR | undefined;
  validate: V.ValidatorT0<CSTOR>;
  validateBest: V.ValidatorT0<CSTOR>;
}

export interface ProviderMap<T> {
  map: Map<string, T>;
  register(name: string[], constructor: T) : void;
  unregister(name: string[]) : void;
  find(name: string) : T | undefined;
  validate: V.ValidatorT0<T>;
}

export function createProviderList<
  CSTOR extends { name: string, compatibility(conditions: C): number },
  C
  >(type: string) : ProviderList<CSTOR, C> {
  let list = <CSTOR[]>[];
  function notes(value) {
    return [<Diagnostic>{ is: "note", msg: `while looking for ${type}: ${value}` }]
          .concat(list.map(s => (<Diagnostic>{
            is: "note",
            msg: `found: ${s.name}`
          })))
  }
  function register(constructor: CSTOR) {
    list.push(constructor);
  }
  function unregister(constructor: CSTOR) {
    let idx = list.indexOf(constructor);
    if (idx !== -1)
      list.splice(idx, 1);
  }
  function find(conditions: C) {
    return list.filter(l => l.compatibility(conditions) > 0);
  }
  function findBest(conditions: C) {
    let best = 0;
    let ret: CSTOR | undefined = undefined;
    for (let o of list) {
      let c = o.compatibility(conditions);
      if (c > best) {
        best = c;
        ret = o;
      }
    }
    return ret;
  }
  function validate(reporter: Reporter, path: AttributePath, value: C) : CSTOR | undefined {
    let builders = find(value);
    if (builders.length === 1)
      return builders[0];
    else if (builders.length === 0)
      path.diagnostic(reporter, { is: "error", msg: `unable to find ${type}`, notes: notes(value) });
    else
      path.diagnostic(reporter, { is: "error", msg: `multiple ${type}s found`, notes: notes(value) });
    return undefined;
  }
  function validateBest(reporter: Reporter, path: AttributePath, value: C) : CSTOR | undefined {
    let builder = findBest(value);
    if (!builder)
      path.diagnostic(reporter, { is: "error", msg: `unable to find ${type}`, notes: notes(value) });
    return builder;
  }
  return {
    list: list,
    register: register,
    unregister: unregister,
    find: find,
    findBest: findBest,
    validate: { validate: validate, traverse: () => `a ${type} provider {${list.map(l => l.name).join(', ')}}` },
    validateBest: { validate: validateBest, traverse: () => `a ${type} provider {${list.map(l => l.name).join(', ')}}` },
  };
}

export function createProviderMap<T>(type: string) : ProviderMap<T> {
  let map = new Map<string, T>();
  return {
    map: map,
    register(names: string[], constructor: T) {
      for (let name of names)
        map.set(name, constructor);
    },
    unregister(names: string[]) {
      for (let name of names)
        map.delete(name);
    },
    find(name: string) { return map.get(name); },
    validate: {
      validate(reporter: Reporter, path: AttributePath, value: string) : T | undefined {
        let v = map.get(value);
        if (v === undefined)
          path.diagnostic(reporter, {
            is: "error",
            msg: `unable to find ${type}`,
            notes: [<Diagnostic>{ is: "note", msg: `while looking for ${type}: ${value}` }]
              .concat(Array.from(map.keys()).map(k => (<Diagnostic>{
                is: "note",
                msg: `found: ${k}`
              })))
          });
        return v;
      },
      traverse() {
        return `a ${type} provider {${[...map.keys()].join(', ')}}`;
      }
    }
  };
}
