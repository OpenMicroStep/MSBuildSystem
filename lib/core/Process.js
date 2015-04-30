var _ = require('underscore');
var child_process = require('child_process');
var EventEmitter = require('events').EventEmitter;

/**
 * Build a whole program could overload the processor everything is run in parallels as nodejs would try to do.
 * The purpose of this class is to be a thin wrapper around nodejs child_process to limit the amount of heavy processes
 * run at the same to the number of processor this computer has.
 * If the limit is reached, then the process run is simply delayed until it can be run.
 *
 * Process are created with child_process.spawn
 * @constructor
 * @fires start exited
 */
function Process() {
  /**
   * @event Process#start
   * @type {ChildProcess}
   */
}

/**
 * Maximum number of allowed concurrent processes
 * @type {number}
 */
Process.maxConcurrentProcess = require('os').cpus().length;

var waitingProcesses = [];
var nbProcessRunning = 0;
function _run(fct, args, startCallback) {
  nbProcessRunning++;
  var ret = fct.apply(child_process, args);
  startCallback(ret);
  var exited = false;
  var cb = function() {
    if(!exited) {
      exited = true;
      _freeOne();
    }
  };
  ret.once('error', cb);
  ret.once('exit', cb);
}


function _runOnceReady(fct, args) {
  args= _.toArray(args);
  var cb = args.pop();

  if(nbProcessRunning < Process.maxConcurrentProcess) {
    _run(fct, args, cb);
  }
  else {
    waitingProcesses.push({fct:fct, args:args, cb:cb});
  }
}

function _freeOne() {
  nbProcessRunning--;
  if(waitingProcesses.length > 0) {
    var o = waitingProcesses.shift();
    _run(o.fct, o.args, o.cb);
  }
}

Process.run = function(command, args, callback) {
  return _runOnceReady(child_process.spawn, [command, args, function(process) {
    var stdout = "";
    var stderr = "";
    var exited = false;
    var timeoutId;

    var ex = null;

    function exithandler(code, signal) {
      if (exited) return;
      exited = true;

      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }

      if (!callback) return;

      // merge chunks
      console.info(command, args.join(" "));
      if (stdout.length) console.log(stdout);
      if (stderr.length) console.log(stderr);

      if (ex) {
        // Will be handled later
      } else if (code === 0 && signal === null) {
        callback(null, stdout, stderr);
        return;
      }
      callback("Command failed", stdout, stderr);
    }

    function errorhandler(e) {
      ex = e;
      process.stdout.destroy();
      process.stderr.destroy();
      exithandler();
    }

    process.stdout.addListener('data', function(chunk) {
      stdout += chunk;
    });

    process.stderr.addListener('data', function(chunk) {
      stderr += chunk;
    });

    process.stderr.setEncoding('utf8');
    process.stdout.setEncoding('utf8');
    process.addListener('close', exithandler);
    process.addListener('error', errorhandler);

  }]);
};

/**
 * @callback Process~startCallback
 * @param {ChildProcess} process
 */

/**
 * Thin wrapper around child_process.spawn
 * @param command
 * @param [args]
 * @param [options]
 * @param {Process~startCallback} startCallback
 * @return {Process}
 */
Process.spawn = function(command, args, options, startCallback) {
  return _runOnceReady(child_process.spawn, arguments);
};

/**
 * Thin wrapper around child_process.fork
 * @param modulePath
 * @param [args]
 * @param [options]
 * @param {Process~startCallback} startCallback
 * @return {Process}
 */
Process.fork = function(modulePath, args, options, startCallback) {
  return _runOnceReady(child_process.fork, arguments);
};

/**
 * Thin wrapper around child_process.exec
 * @param command
 * @param [options]
 * @param callback
 * @param {Process~startCallback} startCallback
 * @return {Process}
 */
Process.exec = function(command, options, callback, startCallback) {
  return _runOnceReady(child_process.exec, arguments);
};

module.exports = {
  run : Process.run,
  spawn : Process.spawn,
  fork : Process.fork,
  exec : Process.exec
};