import {
  StepWithData, Step,
  createProviderList, ProviderList,
} from '@openmicrostep/msbuildsystem.core';
import {
  CompileAttributes, CompileResourceAttributes, LinkAttributes,
} from '../index.priv';


export interface CompilerProvider {
  name: string;
  compatibility(compiler: string) : number;
  do_compile(step: StepWithData<{}, {}, { headers: string[] }>, attributes: CompileAttributes) : void;
  do_generate_compile_command(step: Step<{ cmd?: string }>, attributes: CompileAttributes);
}
export interface ResourceCompilerProvider {
  name: string;
  compatibility(compiler: string) : number;
  do_compile_resource(step: Step, attributes: CompileResourceAttributes) : void;
}

export interface LinkerProvider {
  name: string;
  compatibility(linker: string) : number;
  do_link(step: Step, options: LinkAttributes) : void;
}

export const CompilerProviders: ProviderList<CompilerProvider, string> = createProviderList('compiler provider');
export const ResourceCompilerProviders: ProviderList<ResourceCompilerProvider, string> = createProviderList('resource compiler provider');
export const LinkerProviders: ProviderList<LinkerProvider, string> = createProviderList('linker provider');
