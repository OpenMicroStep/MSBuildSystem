import {
  AttributePath, Reporter, AttributeTypes,
  SelfBuildGraph, createBuildGraphProviderList,
  util
} from '@msbuildsystem/core';
import {JSTarget} from './index';

export function validatePackages(reporter: Reporter, path: AttributePath, value: any) : { [s: string]: any } | undefined {
  if ((value = AttributeTypes.validateObject(reporter, path, value)) !== undefined) {
    path.push('[', '', ']');
    var ret = {};
    for (var k in value) {
      var r = AttributeTypes.validateString(reporter, path.set(k, -2), value[k]);
      if (r !== undefined)
        ret[k] = r;
    }
    path.pop(3);
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