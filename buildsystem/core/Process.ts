import child_process = require('child_process');
var os = require('os');

/**
 * Build a whole program could overload the processor everything is run in parallels as nodejs would try to do.
 * The purpose of this class is to be a thin wrapper around nodejs child_process to limit the amount of heavy processes
 * run at the same to the number of processor this computer has.
 * If the limit is reached, then the process run is simply delayed until it can be run.
 *
 * Process are created with child_process.spawn
 */
class Process {
  static maxConcurrentProcess : number = os.cpus().length;

  static run(command : string, args : string[], env: {[s:string]: string}, callback : (err: string, out: string) => any) {
    var options: any = {};
    if(env) {
      var base = process.env;
      var pathKey = "PATH";
      options.env = {};
      for (var i in base) {
        if (base.hasOwnProperty(i)) {
          if (i.toLowerCase() == "path")
            pathKey= i;
          options.env[i] = base[i];
        }
      }
      if (env["PATH"] && pathKey !== "PATH") {
        env[pathKey] = env["PATH"];
        delete env["PATH"];
      }
      for (var i in env) {
        if (env.hasOwnProperty(i)) {
          options.env[i] = env[i];
        }
      }
    }
    return _runOnceReady(child_process.spawn, [command, args, options, function(process) {
      var out = "";
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

        if (ex) {
          // Will be handled later
        } else if (code === 0 && signal === null) {
          callback(null, out);
          return;
        }
        callback("Command failed: " + command + " " + args.join(" "), out);
      }

      function errorhandler(e) {
        ex = e;
        process.stdout.destroy();
        process.stderr.destroy();
        exithandler(-1, null);
      }

      if (process) {
        process.stdout.addListener('data', function(chunk) {
          out += chunk;
        });

        process.stderr.addListener('data', function(chunk) {
          out += chunk;
        });

        process.stderr.setEncoding('utf8');
        process.stdout.setEncoding('utf8');
        process.addListener('close', exithandler);
        process.addListener('error', errorhandler);
      }
      else {
        exithandler(-1, null);
      }

    }]);
  }
  /** Thin wrapper around child_process.spawn */
  static spawn(command : string, args: string[], options: {}, startCallback : (process : child_process.ChildProcess) => any) {
    _runOnceReady(child_process.spawn, arguments);
  }

  /** Thin wrapper around child_process.fork */
  static fork(modulePath: string, args: string[], options: {}, startCallback: (process: child_process.ChildProcess) => any) {
    _runOnceReady(child_process.fork, arguments);
  }

  /** Thin wrapper around child_process.exec */
  static exec(command: string, options: {}, callback: (error: Error, stdout: Buffer, stderr: Buffer) =>void, startCallback: (process: child_process.ChildProcess) => any) {
    _runOnceReady(child_process.exec, arguments);
  }
}

var waitingProcesses = [];
var nbProcessRunning = 0;
function _run(fct, args, startCallback) {
  nbProcessRunning++;
  console.debug("Run process", args[0], args[1].join(" "));
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
  args= Array.from(args);
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

export = Process;