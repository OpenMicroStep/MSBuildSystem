import {Target, SelfBuildGraph, Reporter, AttributePath, AttributeTypes as V, File, Diagnostic} from "./index.priv";
import * as semver from 'semver';

export class SemVerProvider {
  name: string;
  constructor(
    public readonly package_name: string,
    public readonly package_version: string,
    public readonly priority = 1,
  ) {
    if (!semver.valid(package_version))
      console.warn(`invalid semver version ${package_version} for ${package_name}`);
    this.name = `${package_name}@${package_version}`;
  }

  compatibility(query: string) : number {
    if (query) {
      let [name, version] = query.split('@');
      if (name !== this.package_name)
        return 0;
      if (version && !semver.satisfies(this.package_version, version))
        return 0;
    }
    return this.priority;
  }

  flattenArgs(args: (string | (string | File)[])[]) : string[] {
    return args.map(f => {
      let arg: string;
        if (typeof f === "string")
            arg = f;
        else {
          arg = "";
          for (let a of f)
            arg += typeof a === "string" ? a : a.path;
        }
        return arg;
    });
  }
}

export interface BuildGraphProviderList<P extends Target, T extends SelfBuildGraph<P>> {
  list: Map<string, new (graph: P) => T>;
  register<S extends T, A>(names: string[], constructor: { new (graph: P) : S, prototype: S & A }, attributes: V.ExtensionsNU<A, Target>) : void;
  find: (name: string) => (new (graph: P) => T) | undefined;
  validate: V.ValidatorT<T, P>;
}
export function createBuildGraphProviderList<P extends Target, T extends SelfBuildGraph<P>>(type: string, defaultCstor?: { new (graph: P) : T }) : BuildGraphProviderList<P, T> {
  let list = new Map<string, { new (graph: P) : T }>();
  function notes(value) {
    return [<Diagnostic>{ type: "note", msg: `while looking for ${type}: ${value}` }]
          .concat([...list.keys()].map(name => (<Diagnostic>{
            type: "note",
            msg: `found: ${name}`
          })))
  }
  function register<S extends T, A>(names: string[], constructor: { new (graph: P) : S, prototype: S & A }, attributes: V.ExtensionsNU<A, Target>) {
    SelfBuildGraph.registerAttributes(constructor, attributes);
    names.forEach(name => list.set(name, constructor));
  }
  function find(name: string) {
    return list.get(name);
  }
  function validate(reporter: Reporter, path: AttributePath, value: any, target: P) : T | undefined {
    if (value === undefined && defaultCstor !== undefined)
      return new defaultCstor(target);
    let v = V.validateString.validate(reporter, path, value);
    let ret: T | undefined = undefined;
    if (v !== undefined) {
      let builder = find(v);
      if (builder === undefined) {
        reporter.diagnostic({ type: "error", msg: `unable to find ${type}`, notes: notes(value) });
        builder = defaultCstor;
      }
      if (builder !== undefined) {
        ret = new builder(target);
        ret.resolve(reporter, target);
      }
    }
    return ret;
  }
  return {
    list: list,
    register: register,
    find: find,
    validate: { validate: validate, traverse: () => `a ${type} provider {${[...list.keys()].join(', ')}}` }
  };
}
