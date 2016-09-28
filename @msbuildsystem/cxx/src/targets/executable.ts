import {declareTarget} from '@msbuildsystem/core';
import {CXXTarget} from '../index.priv';

@declareTarget({ type: "CXXExecutable" })
export class CXXExecutable extends CXXTarget {

}
