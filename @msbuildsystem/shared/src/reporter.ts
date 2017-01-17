import {Diagnostic} from './index';
import {format} from 'util';

export class Reporter {
  /** raw logs */
  logs: string = "";
  /** structured diagnostics, use diagnostic(...) or error(...) to add somes */
  diagnostics: Diagnostic[] = [];
  /** true if the task failed, automatically set to true if a diagnostic of type error is added e*/
  failed: boolean = false;
  /** if not null, run a transformation on new diagnostics (ie. set category, prefix path, ...) */
  transform: ((diagnostic: Diagnostic) => Diagnostic)[] = [];

  log(...args) {
    this.logs += format.apply(null, arguments);
  }
  lognl(...args) {
    this.log(...args);
    this.logs += "\n";
  }
  debug(...args) {
    this.log(...args);
  }
  debugnl(...args) {
    this.log(...args);
    this.logs += "\n";
  }

  diagnostic(d: Diagnostic) {
    if (!d) return;
    if (this.transform.length)
      d = this.transform[this.transform.length - 1](d);
    if (!d) return;
    this.diagnostics.push(d);
    if (d.type === "error" || d.type === "fatal error")
      this.failed = true;
  }

  error(err: Error | undefined | null, base?: Diagnostic) {
    if (!err) return;
    this.diagnostic(Diagnostic.fromError(err, base));
  }

  description() {
    var desc = `${this.diagnostic.length} diagnostics: \n`;
    this.diagnostics.forEach(d => {
      desc += ` - [${d.type}] ${d.msg}\n`;
    });
    return desc;
  }

  aggregate(reporter: Reporter) {
    this.failed = this.failed || reporter.failed;
    this.diagnostics.push(...reporter.diagnostics);
  }
}
