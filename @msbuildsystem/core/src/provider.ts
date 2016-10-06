import {File, Task, Step} from "./index.priv";

export type ProviderRequirement = "inputs" | "outputs" | "files" | "dependencies outputs";
export type ProviderAttributeValue = string | {value: string, version: string, versions: string[], minVersion: string, maxVersion: string};
export type ProviderInfo = {[s: string]: string};
export type ProviderConditions = {[s: string]: string|((v) => boolean)};
export type ProviderOptions = {
  action: string,
  args: string[],
  inputs: File[],
  outputs: File[],
  env?: { [s: string]: string},
  requirements?: ProviderRequirement[],
  task?: Task
};

export abstract class Provider {
  type: string;
  info: ProviderInfo;

  constructor(info: ProviderInfo) {
    this.info = info;
  }

  isCompatible(conditions: ProviderConditions) : boolean {
    for (var k in conditions) {
      if (conditions.hasOwnProperty(k)) {
        var cnd = conditions[k];
        var v = this.info[k];
        var ok = typeof cnd === "function" ? cnd(v) : cnd === v;
        if (!ok)
          return false;
      }
    }
    return true;
  }

  /** map the given virtual path to the provider real path */
  abstract map(path: string) : string;

  /** process the given action */
  abstract process(step: Step, options: ProviderOptions);

  static providers: Provider[]= [];
  static find(conditions: ProviderConditions) : Provider | null {
    var idx = Provider.providers.findIndex((provider) => {
      return provider.isCompatible(conditions);
    });
    return (idx !== -1) ? Provider.providers[idx] : null;
  }
  static register(provider: Provider) {
    console.info("register provider", provider.info);
    Provider.providers.push(provider);
  }
  static unregister(provider: Provider) {
    console.info("unregister provider", provider.info);
    var idx = Provider.providers.indexOf(provider);
    if (idx !== -1)
      Provider.providers.splice(idx, 1);
  }
}
