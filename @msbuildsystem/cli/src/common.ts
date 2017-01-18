import { Reporter, Diagnostic } from '@msbuildsystem/core';
import * as chalk from 'chalk';

export const colors = {
  "note": chalk.cyan,
  "remark": chalk.cyan,
  "warning": chalk.magenta,
  "error": chalk.red,
  "fatal error": chalk.red
};
export function stats(diagnostics: Diagnostic[]) {
  if (diagnostics.length === 0)
    return '';
  let types = ["note", "remark", "warning", "error", "fatal error"];
  let stats = diagnostics.reduce((prev, current) => {
    prev[current.type] = (prev[current.type] || 0) + 1;
    return prev;
  }, {});
  return ' (' + types
    .map(t => stats[t] ? `${stats[t]} ${colors[t](t + (stats[t] > 1 ? 's' : ''))}` : '')
    .filter(t => !!t)
    .join(', ') + ')';
}
export function printDiagnostic(d: Diagnostic) : string {
  let ret = "";
  if (d.path) {
    ret += d.path;
    if (d.row) {
      ret += ':' + d.row;
      if (d.col)
        ret += ':' + d.col;
    }
    ret += " ";
  }
  ret += colors[d.type](d.type) + ': ' + d.msg;
  return ret;
}

export function printReport(reporter: Reporter, prefix: string, action: string, duration?: string) {
  duration = duration ? ` (${duration})` : "";
  if (reporter.diagnostics.length) {
    console.info('');
    console.info(reporter.diagnostics.map(printDiagnostic).join('\n'));
    console.info('');
    if (reporter.failed)
      console.info(`${prefix} failed to ${action}: ${reporter.diagnostics.length} issues${stats(reporter.diagnostics)}${duration}`);
    else
      console.info(`${prefix} ${action}: ${reporter.diagnostics.length} issues${stats(reporter.diagnostics)}${duration}`);
  }
  else {
    console.info(`${prefix} ${action} without issues${duration}`);
  }
  return !reporter.failed;
}
