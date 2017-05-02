import {Target, AttributeTypes} from '@openmicrostep/msbuildsystem.core';
import {CXXFramework} from '../index.priv';

export class CXXBundle extends CXXFramework {
  bundleExtension: string;
  bundleBasePath: string;
}
Target.register(["CXXBundle"], CXXBundle, {
  bundleExtension: AttributeTypes.defaultsTo(AttributeTypes.validateString, "bundle") ,
  bundleBasePath : AttributeTypes.defaultsTo(AttributeTypes.validateString, (t: CXXBundle) => `${t.outputName}.${t.bundleExtension}/Contents`, '${outputName}.${bundleExtension}/Contents'),
});
