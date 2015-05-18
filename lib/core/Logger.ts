var dateFormat = require("dateformat");
import util = require('util');

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
    'error': {level: 4, name: "ERROR", map:con.error},
    'warn':  {level: 3, name: " WARN", map:con.warn },
    'info':  {level: 2, name: " INFO", map:con.info },
    'log':   {level: 1, name: "DEBUG", map:con.log  },
    'debug': {level: 1, name: "DEBUG", map:con.log  },
    'trace': {level: 0, name: "TRACE", map:con.log  }
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
      var date = dateFormat(pattern);
      var memory = process.memoryUsage();
      var memoryStr = (memory && memory.heapUsed && bytesSizeToHumanSize(memory.heapUsed)) || "Unknown";
      return org.call(con, date, memoryStr, method.name, util.format.apply(util.format, arguments));
    };
  }
  for(var f in methods) {
    if(methods.hasOwnProperty(f))
      setupMethod(f);
  }

  con.info("Log level set to '%s'", levelname);
}

export = setup;