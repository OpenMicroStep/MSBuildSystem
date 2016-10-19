import {
  AttributePath, Reporter, AttributeResolvers,
  SelfBuildGraph, createBuildGraphProviderList
} from '@msbuildsystem/core';
import {JSTarget} from './index';

export type JSCompiler = SelfBuildGraph<JSTarget>;
export const JSCompilers = createBuildGraphProviderList<JSTarget, JSCompiler>('compiler');

