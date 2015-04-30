var dateFormat = require("dateformat");

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

var methods = {
  'assert': {level: 5, name: "ASSERT"},
  'error': {level: 4, name: "ERROR"},
  'warn': {level: 3, name: "WARN "},
  'info': {level: 2, name: "INFO "},
  'dir': {level: 1, name: "DEBUG"},
  'log': {level: 1, name: "DEBUG"},
  'debug': {level: 1, name: "DEBUG"},
  'trace': {level: 0, name: "TRACE"}
};

module.exports = function (con, pattern, level) {
  process.stdout.write("Setting up logger, level=" + (level || 'info') + "\n");
  level = methods[level || 'info'].level;

  ['log', 'info', 'warn', 'error', 'dir', 'assert'].forEach(function (f) {
    var method = methods[f];
    if (method.level < level) {
      con[f] = function () {};
      return;
    }

    var org = con[f];
    con[f] = function () {
      var date = dateFormat(pattern);
      var memory = process.memoryUsage();
      var args = new Array(arguments.length + 3);
      memory = (memory && memory.heapUsed && bytesSizeToHumanSize(memory.heapUsed)) || "Unknown";
      args[0] = date;
      args[1] = memory;
      args[2] = method.name;
      for (var i = 0; i < arguments.length; ++i)
        args[3 + i] = arguments[i];
      return org.apply(con, args);

    };
  });

  con.debug = con.log;
};