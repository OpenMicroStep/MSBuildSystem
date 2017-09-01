import { Reporter, TaskReporter, Diagnostic, util } from '@openmicrostep/msbuildsystem.core';
import * as chalk from 'chalk';
import * as fs from 'fs';

export type Stats = {
  "note": number,
  "remark": number,
  "warning": number,
  "error": number,
  "fatal error": number,
};
function reduceStats(previous, current) {
  previous["note"]        += current["note"];
  previous["remark"]      += current["remark"];
  previous["warning"]     += current["warning"];
  previous["error"]       += current["error"];
  previous["fatal error"] += current["fatal error"];
}

export class Report {
  constructor(public name: string, reporter?: (Reporter | TaskReporter), duration?: number) {
    this.diagnostics = reporter ? reporter.diagnostics : [];
    this.logs = reporter ? (reporter as TaskReporter).logs : undefined;
    this.failed = reporter ? reporter.failed : false;
    this.duration = duration;
    this.stats = {
      "note": 0,
      "remark": 0,
      "warning": 0,
      "error": 0,
      "fatal error": 0,
    };
    this.diagnostics.reduce((prev, current) => {
      prev[current.type] += 1;
      return prev;
    }, this.stats);
    if (this.failed && !this.stats.error && !this.stats["fatal error"])
      this.stats["fatal error"] += 1;
  }

  diagnostics: Diagnostic[];
  logs?: string;
  failed: boolean;
  duration?: number;
  stats: Stats;
}

function indent(indent: string, text: string) {
  return text ? indent + text.replace(/\n/g, `\n${indent}`) : text;
}
function embed(prefix: string, text: string, suffix: string) {
  return text ? prefix + text + suffix : text;
}

export class ReporterPrinter {
  static types = ["note", "remark", "warning", "error", "fatal error"];
  colors = {
    "note": chalk.cyan,
    "remark": chalk.cyan,
    "warning": chalk.magenta,
    "error": chalk.red,
    "fatal error": chalk.red
  };
  totalDiagnosticCount = 0;
  report: Report = new Report('global');
  reports: Report[] = [];
  push(report: Report) {
    this.report.diagnostics.push(...report.diagnostics);
    this.report.failed = this.report.failed || report.failed;
    reduceStats(this.report.stats, report.stats);
    this.totalDiagnosticCount += report.diagnostics.length;
    this.reports.push(report);
  }
  formatStats() {
    let stats = this.report.stats;
    return ReporterPrinter.types
      .filter(type => stats[type] > 0)
      .map(type => `${stats[type]} ${this.colors[type](type + (stats[type] > 1 ? 's' : ''))}`)
      .join(', ');
  }
  formatReports(name: string, duration?: number) {
    let ret = "";
    for (let report of this.reports) {
      if (report.failed || report.diagnostics.length)
        ret += `${chalk.grey(this.formatReportConclusion(report))}:\n${this.formatReportLogs(report, '  ')}\n`;
    }
    ret += this.formatReportConclusion(Object.assign({}, this.report, { name: name, duration: duration }));
    return ret;
  }
  hasStats() {
    let stats = this.report.stats;
    return ReporterPrinter.types
      .filter(type => stats[type] > 0).length > 0;
  }
  formatDiagnostic(d: Diagnostic, indent = "", showContext = true) {
    let ret = indent;
    if (d.path) {
      ret += d.path;
      if (d.row) {
        ret += ':' + d.row;
        if (d.col)
          ret += ':' + d.col;
      }
      ret += " ";
    }
    ret += this.colors[d.type](d.type) + ': ' + d.msg;
    if (d.path && showContext && d.row && d.col) {
      try {
        let r0 = {
          srow: d.row, scol: d.col,
          erow: d.row, ecol: d.col + 1,
        };
        let ranges: Diagnostic.Range[] = [r0];
        if (d.ranges) ranges.push(...d.ranges);
        ranges = ranges.sort((a, b) => {
          if (a.srow < b.srow)
            return -1;
          if (a.srow === b.srow) {
            if (a.scol < b.scol)
              return -1;
            if (a.scol === b.scol && a.erow < b.erow || (a.erow === b.erow && a.ecol < b.ecol))
              return -1;
          }
          return +1;
        });
        let contents = fs.readFileSync(d.path, { encoding: 'utf8' });
        let line = 1;
        let start_line_pos = 0, end_line_pos: number;
        let print_pos = 1;
        for (let i = 0; i < ranges.length; i++) {
          let r = ranges[i];
          let lines: string[] = [];
          while (line < r.srow && (end_line_pos = contents.indexOf('\n', start_line_pos)) !== -1) {
            line++;
            print_pos = 1;
            start_line_pos = end_line_pos + 1;
          }
          while (line < r.erow && (end_line_pos = contents.indexOf('\n', start_line_pos)) !== -1) {
            lines.push(contents.substring(start_line_pos, end_line_pos).replace(/\r/g, ''));
            line++;
            start_line_pos = end_line_pos + 1;
          }
          end_line_pos = contents.indexOf('\n', start_line_pos);
          if (end_line_pos === -1)
            end_line_pos = contents.length;
          lines.push(contents.substring(start_line_pos, end_line_pos).replace(/\r/g, ''));

          if (print_pos === 1)
            ret += "\n" + indent + lines[0] + "\n" + indent;
          if (print_pos < r.scol)
            ret += " ".repeat(r.scol - print_pos);
          if (r.srow === r.erow) {
            ret += chalk.green((r === r0 ? "^" : "~").repeat(r.ecol - Math.max(print_pos, r.scol)));
            print_pos = r.ecol;
          }
          else {
            ret += "~".repeat(lines[0].length + 1 - r.scol);
            let last = lines.length - 1;
            for (let l = 1, len = lines.length; l < len; i++) {
              let line = lines[l];
              ret += "\n" + indent + line + "\n" + indent;
              ret += chalk.green("~".repeat(l === last ? r.ecol : line.length));
            }
            print_pos = r.ecol;
          }
        }
      }
      catch(e) { }
    }
    if (d.notes && d.notes.length)
      d.notes.forEach(d => ret += "\n" + this.formatDiagnostic(d, indent + "  ", showContext));
    return ret;
  }
  formatReportConclusion(report: Report) {
    let ret = '';
    ret += `${report.name} ${report.failed ? chalk.red('failed') : chalk.green('succeeded')}`;
    if (report.diagnostics.length === 1)
      ret += ` with ${report.diagnostics.length} issue`;
    else if (report.diagnostics.length > 1)
      ret += ` with ${report.diagnostics.length} issues`;
    else if (!report.failed)
      ret += ` without issues`;
    if (report.diagnostics.length > 0)
      ret += ` (${this.formatStats()})`;
    if (report.duration !== undefined)
      ret += ` (took ${util.Formatter.duration.millisecond.short(report.duration)})`;
    return ret;
  }
  formatReportLogs(report: Report, indentation: string) {
    let ret = '';
    if (report.diagnostics.length) {
      ret += report.diagnostics.map(d => this.formatDiagnostic(d, indentation)).join('\n');
      if (report.failed && report.stats && report.stats.error === 0 && report.stats["fatal error"] === 0 && report.logs)
        ret += "\n" + indent(indentation, report.logs);
    }
    else if (report.failed && report.logs) {
      ret += indent(indentation, report.logs);
    }
    else {
      ret += `${indentation}task failed for unknown reasons`;
    }
    return ret;
  }
}
