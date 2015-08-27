/// <reference path="../../typings/tsd.d.ts" />
/* @flow */
'use strict';

var dateFormat = require("dateformat");
import util = require('util');
import chalk = require("chalk");
//chalk.enabled = true;
var startTime = (new Date()).getTime();
function pad(num, mask) {
  return (mask + num).slice(-Math.max(mask.length, (num + "").length));
}
function bytesSizeToHumanSize(fileSizeInBytes) {
  var i = -1;
  var byteUnits = [' kB', ' MB', ' GB', ' TB'];
  do {
    fileSizeInBytes = fileSizeInBytes / 1024;
    i++;
  } while (fileSizeInBytes > 1024);

  return pad(fileSizeInBytes.toFixed(2), "      ") + byteUnits[i];
}

function setup(con, levelname: string = 'info') {
  var methods = {
    'error': {level: 4, name: "ERROR", map:con.log, fmt:chalk.red.bold  },
    'warn':  {level: 3, name: " WARN", map:con.log, fmt:chalk.yellow  },
    'info':  {level: 2, name: " INFO", map:con.log, fmt:function(s) { return s; }  },
    'log':   {level: 1, name: "DEBUG", map:con.log,  fmt:chalk.gray },
    'debug': {level: 1, name: "DEBUG", map:con.log,  fmt:chalk.gray  },
    'trace': {level: 0, name: "TRACE", map:con.log,  fmt:chalk.gray  }
  };
  var level = methods[levelname].level;
  var pattern = '[mmm dd HH:MM:ss.l]';


  function setupMethod(f)
  {
    var method = methods[f];
    if (method.level < level) {
      con[f] = function () {};
      return;
    }

    var org = method.map;
    con[f] = function () {
      var diff = pad(((new Date()).getTime() - startTime).toString() + "ms", "        ");
      var date = dateFormat(pattern);
      var memory = process.memoryUsage();
      var memoryStr = (memory && memory.heapUsed && bytesSizeToHumanSize(memory.heapUsed)) || "Unknown";
      return org.call(con, date, diff + " ", memoryStr, method.fmt(method.name + " " + util.format.apply(util.format, arguments)));
    };
  }
  for(var f in methods) {
    if(methods.hasOwnProperty(f))
      setupMethod(f);
  }

  con.info("Log level set to '%s'", levelname);
}

export = setup;