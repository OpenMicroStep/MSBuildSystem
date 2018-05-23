import {
  PathReporter, Reporter, AttributeTypes,
  SelfBuildGraph, createBuildGraphProviderList, BuildGraphProviderList,
  util
} from '@openmicrostep/msbuildsystem.core';
import {JSTarget} from './index';

export function validatePackages(at: PathReporter, value: any) : { [s: string]: any } | undefined {
  if ((value = AttributeTypes.validateObject.validate(at, value)) !== undefined) {
    at.pushArray();
    var ret = {};
    for (var k in value) {
      var r = AttributeTypes.validateString.validate(at.setArrayKey(k), value[k]);
      if (r !== undefined)
        ret[k] = r;
    }
    at.popArray();
    value = ret;
  }
  return value;
}

export interface JSPackager extends SelfBuildGraph<JSTarget> {
  absoluteCompilationOutputDirectory() : string;
}

export class DefaultJSPackager extends SelfBuildGraph<JSTarget> implements JSPackager {
  constructor(graph: JSTarget) {
    super({ type: "packager", name: "javascript default" }, graph);
  }

  absoluteCompilationOutputDirectory() : string {
    return util.pathJoinIfRelative(this.graph.paths.output, this.graph.outputFinalName || this.graph.outputName);
  }
}

export const JSPackagers = createBuildGraphProviderList<JSTarget, JSPackager>('packager', DefaultJSPackager);
