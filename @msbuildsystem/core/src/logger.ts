var dateFormat = require("dateformat");
import * as util from 'util';
import * as chalk from 'chalk';
import {util as msutil} from './index.priv';
const {pad, formatSize, timeElapsed} = msutil;

//chalk.enabled = true;
var startTime = Date.now();

function memStr() : string {
  var memory = process.memoryUsage();
  var memoryStr = (memory && memory.heapUsed && formatSize(memory.heapUsed)) || "Unknown";
  return memoryStr;
}

export type Logger = {
  error(message?: any, ...optionalParams: any[]) : void,
  warn(message?: any, ...optionalParams: any[]) : void,
  info(message?: any, ...optionalParams: any[]) : void,
  debug(message?: any, ...optionalParams: any[]) : void,
  trace(message?: any, ...optionalParams: any[]) : void,
}
var consolelog = console.log;
var methods = [
  {fn: 'error', level: 4, name: "ERROR", fmt:chalk.red.bold  },
  {fn: 'warn' , level: 3, name: " WARN", fmt:chalk.yellow  },
  {fn: 'info' , level: 2, name: " INFO", fmt:s => s },
  {fn: 'log'  , level: 1, name: "DEBUG", fmt:chalk.gray },
  {fn: 'debug', level: 1, name: "DEBUG", fmt:chalk.gray  },
  {fn: 'trace', level: 0, name: "TRACE", fmt:chalk.gray  }
];

type LoggerOptions = {
  on?: any,
  level?: 'error' | 'warn' | 'info' | 'debug' | 'trace',
  colors?: boolean,
  gc?: boolean,
  writer?: (message?: any, ...args: any[]) => void
}
export function install(options: LoggerOptions) : Logger {

  var level = methods[options.level || 'info'].level;
  var pattern = '[mmm dd HH:MM:ss.l]';
  var con = options.on || {};
  var writer = options.writer || consolelog;
  var gc = options.gc && global.gc;

  function setupMethod(f)
  {
    var method = methods[f];
    if (method.level < level) {
      con[f] = function () {};
      return;
    }

    con[f] = function () {
      var elapsed = (Date.now() - startTime);
      var diff = pad((elapsed / 1000).toFixed(2) + "s", "        ");
      var date = dateFormat(pattern);
      var mem = memStr();
      if (gc) {
        var t0 = timeElapsed();
        global.gc();
        mem += " -> " + memStr() + " (" + pad((t0() / 1e6).toFixed(0), "   ") + "ms)";
      }
      return writer.call(con, date, diff + " ", mem, method.fmt(method.name + " " + util.format.apply(util.format, arguments)));
    };
  }
  for(var f in methods) {
    if(methods.hasOwnProperty(f))
      setupMethod(f);
  }

  con.info("Log level set to '%s'", options.level || 'info', global.gc ? "with force GC at each log" : "");
  return con;
}
