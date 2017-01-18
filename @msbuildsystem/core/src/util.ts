export * from '@msbuildsystem/shared/util';
import * as util from '@msbuildsystem/shared/util';
import * as path from 'path';

export function pathJoinIfRelative(basePath: string, relativeOrAbsolutePath: string) {
  return path.isAbsolute(relativeOrAbsolutePath) ? relativeOrAbsolutePath : path.join(basePath, relativeOrAbsolutePath);
}

export function pathRelativeToBase(basePath: string, absolutePath: string) {
  return path.relative(basePath, absolutePath);
}

export function performanceCounter(format: "long" | "short") : () => string;
export function performanceCounter() : () => number;
export function performanceCounter(format?: "long" | "short") : () => number | string {
  let t0 = process.hrtime();
  return function() {
    var diff = process.hrtime(t0);
    var ns = diff[0] * 1e9 + diff[1];
    var ms = (ns / 1e6);
    return format ? util.formatDuration(ms, { format: format }) : ms;
  };
}

