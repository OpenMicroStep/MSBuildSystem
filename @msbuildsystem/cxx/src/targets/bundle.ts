import {declareTarget} from '@msbuildsystem/core';
import {CXXFramework} from '../index.priv';

@declareTarget({ type: "CXXBundle" })
export class CXXBundle extends CXXFramework {
  bundleExtension: string = "bundle";
  bundleBasePath: string = this.outputName + "." + this.bundleExtension + "/Contents";
}
