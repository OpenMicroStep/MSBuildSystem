export * from '@msbuildsystem/shared/util';
import * as path from 'path';

export function pathJoinIfRelative(basePath: string, relativeOrAbsolutePath: string) {
  return path.isAbsolute(relativeOrAbsolutePath) ? relativeOrAbsolutePath : path.join(basePath, relativeOrAbsolutePath);
}

export function pathRelativeToBase(basePath: string, absolutePath: string) {
  return path.relative(basePath, absolutePath);
}
