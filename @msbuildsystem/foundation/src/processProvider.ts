import {createCachedProviderList, File, ProviderList, Step} from '@msbuildsystem/core';

export enum ProcessProviderRequirement {
  Inputs,
  Outputs,
  Files,
  DependenciesOutputs
};
export type ProcessProviderInfo = {[s: string]: string};
export type ProcessProviderConditions = {[s: string]: string|((v) => boolean)};
export type ProcessProviderOptions = {
  action: string,
  inputs: File[],
  outputs: File[],
  requirements: ProcessProviderRequirement[],
  arguments: string[],
  cwd?: string,
  env?: { [s: string]: string},
};

export const ProcessProviders = createCachedProviderList<ProcessProvider, ProcessProviderConditions>('provider');
export abstract class ProcessProvider {
  type: string;
  info: ProcessProviderInfo;
  name: string;

  constructor(info: ProcessProviderInfo) {
    this.info = info;
  }

  isCompatible(conditions: ProcessProviderConditions) : boolean {
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
  abstract process(step: Step<{ output?: string, err?: any }>, options: ProcessProviderOptions);
}
