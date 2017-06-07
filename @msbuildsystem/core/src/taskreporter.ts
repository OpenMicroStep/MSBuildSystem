import {Reporter} from './index.priv';
import {format} from 'util';

export class TaskReporter extends Reporter {
  /** raw logs */
  logs: string = "";

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
}
