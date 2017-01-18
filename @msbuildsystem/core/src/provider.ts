import {Target, SelfBuildGraph, Reporter, AttributePath, AttributeTypes} from "./index.priv";

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
