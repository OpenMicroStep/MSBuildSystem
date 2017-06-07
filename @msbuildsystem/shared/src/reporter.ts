import {Diagnostic} from './index';

export class Reporter {
  /** structured diagnostics, use diagnostic(...) or error(...) to add somes */
  diagnostics: Diagnostic[] = [];
  /** true if the task failed, automatically set to true if a diagnostic of type error is added e*/
  failed: boolean = false;
  /** if not null, run a transformation on new diagnostics (ie. set category, prefix path, ...) */
  transform: ((diagnostic: Diagnostic) => Diagnostic)[] = [];

  snapshot() : { count: number, failed: boolean } {
    return { count: this.diagnostics.length, failed: this.failed };
  }

  diagnosticsAfter(snapshot: { count: number, failed: boolean }) {
    return this.diagnostics.slice(snapshot.count);
  }

  rollback(snapshot: { count: number, failed: boolean }) {
    if (this.diagnostics.length > snapshot.count)
      this.diagnostics.splice(snapshot.count, this.diagnostics.length - snapshot.count);
    this.failed = snapshot.failed;
  }

  hasChanged(snapshot: { count: number, failed: boolean }) {
    return this.failed !== snapshot.failed || this.diagnostics.length !== snapshot.count;
  }

  diagnostic(d: Diagnostic) {
    if (!d) return;
    if (this.transform.length) {
      let i = this.transform.length;
      while (i > 0)
        d = this.transform[--i](d);
    }
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
    reporter.diagnostics.forEach(d => this.diagnostic(d));
  }
}
export namespace Reporter {
  export function transformWithCategory(category: string) {
    return function setDiagCategory(diagnostic: Diagnostic) {
      diagnostic.category = category;
      return diagnostic;
    };
  }
}
