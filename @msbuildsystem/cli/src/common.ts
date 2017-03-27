import { Reporter, Diagnostic, util } from '@msbuildsystem/core';
import * as chalk from 'chalk';

export const colors = {
  "note": chalk.cyan,
  "remark": chalk.cyan,
  "warning": chalk.magenta,
  "error": chalk.red,
  "fatal error": chalk.red
};

export type Report = { name: string, diagnostics: Diagnostic[], logs: string, failed: boolean, duration?: number, stats: Stats };
export type Stats = {
    "note": number,
    "remark": number,
    "warning": number,
    "error": number,
    "fatal error": number,
  };
function mkStats() {
  return {
    "note": 0,
    "remark": 0,
    "warning": 0,
    "error": 0,
    "fatal error": 0,
  };
}
function indent(indent: string, text: string) {
  return text ? indent + text.replace(/\n/g, `\n${indent}`) : text;
}
function embed(prefix: string, text: string, suffix: string) {
  return text ? prefix + text + suffix : text;
}
function reduce(diagnostics: Diagnostic[], stats: Stats) {
  return diagnostics.reduce((prev, current) => {
    prev[current.type] += 1;
    return prev;
  }, stats);
}
export class ReporterPrinter {
  static types = ["note", "remark", "warning", "error", "fatal error"];
  static colors = {
    "note": chalk.cyan,
    "remark": chalk.cyan,
    "warning": chalk.magenta,
    "error": chalk.red,
    "fatal error": chalk.red
  };
  totalDiagnosticCount = 0;
  report: Report = {
    name: '',
    diagnostics: [],
    failed: false,
    logs: '',
    stats: mkStats()
  };
  reports: Report[] = [];
  push(report: Report) {
    this.report.diagnostics.push(...report.diagnostics);
    this.report.failed = this.report.failed || report.failed;
    reduce(report.diagnostics, this.report.stats);
    this.totalDiagnosticCount += report.diagnostics.length;
    this.reports.push(report);
  }
  formatStats() {
    return ReporterPrinter.formatStats(this.report.stats);
  }
  formatReports(name: string, duration?: number) {
    let ret = "";
    for (let report of this.reports) {
      if (report.failed || report.diagnostics.length)
        ret += `${ReporterPrinter.formatReportConclusion(report)}:\n${embed('', indent('  ', ReporterPrinter.formatReportLogs(report)), '\n')}\n`;
    }
    ret += ReporterPrinter.formatReportConclusion(Object.assign({}, this.report, { name: name, duration: duration }));
    return ret;
  }
  static hasStats(stats: Stats) {
    return ReporterPrinter.types
      .filter(type => stats[type] > 0).length > 0;
  }
  static formatStats(stats: Stats) {
    return ReporterPrinter.types
      .filter(type => stats[type] > 0)
      .map(type => `${stats[type]} ${ReporterPrinter.colors[type](type + (stats[type] > 1 ? 's' : ''))}`)
      .join(', ');
  }
  static formatDiagnostic(d: Diagnostic) {
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
  static formatReportConclusion(report: Report) {
    let ret = '';
    ret += `${report.name} ${report.failed ? 'failed' : 'succeeded'}`;
    if (report.diagnostics.length > 0)
      ret += ` with ${report.diagnostics.length} issues`;
    else if (!report.failed)
      ret += ` without issues`;
    if (report.diagnostics.length > 0 && report.stats)
      ret += ` (${ReporterPrinter.formatStats(report.stats)})`;
    if (report.duration !== undefined)
      ret += ` (${util.Formatter.duration.millisecond.short(report.duration)})`;
    return ret;
  }
  static formatReportLogs(report: Report) {
    let ret = '';
    if (report.diagnostics.length) {
      ret += report.diagnostics.map(ReporterPrinter.formatDiagnostic).join('\n');
      if (report.failed && report.stats && report.stats.error === 0 && report.stats["fatal error"] === 0)
        ret += report.logs;
    }
    else if (report.failed) {
      ret += report.logs;
    }
    return ret;
  }
}

export function mkReport(name: string, reporter: Reporter, duration?: number) : Report {
  return { name: name, logs: reporter.logs, diagnostics: reporter.diagnostics, failed: reporter.failed, duration: duration, stats: reduce(reporter.diagnostics, mkStats()) };
}

export function printReport(name: string, reporter: Reporter, duration?: number) {
  let report: Report = mkReport(name, reporter, duration);
  if (report.failed || report.diagnostics.length)
    console.log(embed('\n', ReporterPrinter.formatReportLogs(report), '\n'));
  console.log(ReporterPrinter.formatReportConclusion(report));
  return !reporter.failed;
}
