import {declareTarget} from '@msbuildsystem/core';
import {CXXTarget, CXXLinkType} from '../index.priv';

@declareTarget({ type: "CXXExecutable" })
export class CXXExecutable extends CXXTarget {
  linkType = CXXLinkType.EXECUTABLE;
}
