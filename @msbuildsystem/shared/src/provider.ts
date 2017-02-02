import {Reporter, AttributePath, Diagnostic, util} from "./index";

export interface ProviderList<CSTOR, C> {
  list: CSTOR[];
  register(constructor: CSTOR) : void;
  unregister(constructor: CSTOR) : void;
  find(conditions: C) : CSTOR[];
  validate(reporter: Reporter, path: AttributePath, value: any) : CSTOR | undefined;
}

export interface ProviderMap<T> {
  map: Map<string, T>;
  register(name: string[], constructor: T) : void;
  unregister(name: string[]) : void;
  find(name: string) : T | undefined;
  validate(reporter: Reporter, path: AttributePath, value: any) : T | undefined;
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
  >(type: string) {
  return Object.assign(createProviderList<CSTOR, C>(type), {
    loadCost: 0,
    loaded: new Map<string, CSTOR | undefined>(),
    safeLoadIfOutOfDate(this: ProviderList<CSTOR, C> & { loaded: Map<string, CSTOR | undefined>, loadCost: number }, name: string, loader: () => CSTOR | undefined) {
      if (!this.loaded.has(name)) {
        let t0 = util.now();
        try {
          let p = loader();
          this.loaded.set(name, p);
          if (p)
            this.register(p);
        } catch (e) {}
        this.loadCost += util.now() - t0;
      }
    }
  });
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
    validate(reporter: Reporter, path: AttributePath, value: string) : T | undefined {
      let v = map.get(value);
      if (v === undefined)
        path.diagnostic(reporter, {
          type: "error",
          msg: `unable to find ${type}`,
          notes: [<Diagnostic>{ type: "note", msg: `while looking for ${type}: ${value}` }]
            .concat(Array.from(map.keys()).map(k => (<Diagnostic>{
              type: "note",
              msg: `found: ${k}`
            })))
        });
      return v;
    }
  };
}
