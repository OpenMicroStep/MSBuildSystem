export * from '@openmicrostep/msbuildsystem.shared/util';
import * as path from 'path';

export function pathJoinIfRelative(basePath: string, relativeOrAbsolutePath: string) {
  return path.isAbsolute(relativeOrAbsolutePath) ? relativeOrAbsolutePath : path.join(basePath, relativeOrAbsolutePath);
}

export function pathRelativeToBase(basePath: string, absolutePath: string) {
  return path.relative(basePath, absolutePath);
}

export function pathAreEquals(a: string, b: string) {
  return pathNormalized(a) === pathNormalized(b);
}
export function pathNormalized(p: string) {
  p = path.normalize(p).replace(/\\/g, '/');
  if (p.endsWith('/'))
    p = p.substring(0, p.length - 1);
  return p;
}
