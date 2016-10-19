import {
  AttributePath, Reporter, AttributeResolvers,
  SelfBuildGraph, createBuildGraphProviderList
} from '@msbuildsystem/core';
import {JSTarget} from './index';

export const JSPackagers = createBuildGraphProviderList<JSTarget, JSPackager>('packager');

export class JSPackager extends SelfBuildGraph<JSTarget> {

}
