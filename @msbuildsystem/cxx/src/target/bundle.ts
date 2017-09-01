import {Target, AttributeTypes} from '@openmicrostep/msbuildsystem.core';
import {CXXFramework} from '../index.priv';

export class CXXBundle extends CXXFramework {
  defaultBundleBasePath() {
    return `${this.toolchain.bundleBasePath()}/${this.outputName}.${this.bundleExtension}/Contents`;
  }
}
Target.register(["cxx-bundle"], CXXBundle, {
  bundleExtension: AttributeTypes.defaultsTo(AttributeTypes.validateString, "bundle") ,
  bundleBasePath : AttributeTypes.defaultsTo(AttributeTypes.validateString, (t: CXXBundle) => t.defaultBundleBasePath(), '${outputName}.${bundleExtension}/Contents'),
});
