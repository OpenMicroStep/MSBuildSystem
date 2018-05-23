import {Target, AttributeTypes} from '@openmicrostep/msbuildsystem.core';
import * as path from 'path';

export class CopyTarget extends Target {
  copyBasePath: string;

  absoluteCopyFilesPath() {
    return path.join(this.paths.output, this.copyBasePath);
  }
}
Target.register(['copy'], CopyTarget, {
  copyBasePath: AttributeTypes.defaultsTo(AttributeTypes.validateString, "") ,
});
