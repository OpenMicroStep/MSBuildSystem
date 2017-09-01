import {Target} from '@openmicrostep/msbuildsystem.core';
import {CXXTarget, CXXLinkType} from '../index.priv';

export class CXXExecutable extends CXXTarget {
  linkType = CXXLinkType.EXECUTABLE;
}
Target.register(["cxx-executable"], CXXExecutable, {});
