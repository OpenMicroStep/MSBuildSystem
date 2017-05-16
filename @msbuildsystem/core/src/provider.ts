import {Target, SelfBuildGraph, Reporter, AttributePath, AttributeTypes} from "./index.priv";

export interface BuildGraphProviderList<P extends Target, T extends SelfBuildGraph<P>> {
  list: Map<string, new (graph: P) => T>;
  register<S extends T, A>(names: string[], constructor: { new (graph: P) : S, prototype: S & A }, attributes: AttributeTypes.ExtensionsNU<A, Target>) : void;
  declare: (names: string[]) => (constructor: new (graph: P) => T) => void;
  find: (name: string) => (new (graph: P) => T) | undefined;
  validate: AttributeTypes.ValidatorT<T, P>;
}
export function createBuildGraphProviderList<P extends Target, T extends SelfBuildGraph<P>>(type: string, defaultCstor?: { new (graph: P) : T }) : BuildGraphProviderList<P, T> {
  let list = new Map<string, { new (graph: P) : T }>();
  function declareBuildGraphProvider(names: string[]) {
    return function (constructor: { new (graph: P) : T }) {
      names.forEach(name => {
        list.set(name, constructor);
      });
    };
  }
  function register<S extends T, A>(names: string[], constructor: { new (graph: P) : S, prototype: S & A }, attributes: AttributeTypes.ExtensionsNU<A, Target>) {
    SelfBuildGraph.registerAttributes(constructor, attributes);
    names.forEach(name => list.set(name, constructor));
  }
  function find(name: string) {
    return list.get(name);
  }
  function validate(reporter: Reporter, path: AttributePath, value: any, target: P) : T | undefined {
    if (value === undefined && defaultCstor !== undefined)
      return new defaultCstor(target);
    let v = AttributeTypes.validateString.validate(reporter, path, value);
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
    register: register,
    declare: declareBuildGraphProvider,
    find: find,
    validate: { validate: validate, traverse: () => `a ${type} provider {${[...list.keys()].join(', ')}}` }
  };
}
