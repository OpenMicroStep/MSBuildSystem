import * as child_process from 'child_process';
import * as os from 'os';

/**
 * Build a whole program could overload the processor everything is run in parallels as nodejs would try to do.
 * The purpose of this class is to be a thin wrapper around nodejs child_process to limit the amount of heavy processes
 * run at the same to the number of processor this computer has.
 * If the limit is reached, then the process run is simply delayed until it can be run.
 *
 * Process are created with child_process.spawn
 */
export var maxConcurrentProcess: number = os.cpus().length;

export function run(
  command: string,
  args: string[],
  env: {[s: string]: string},
  callback: (err: Error | null, code: number, signal: string, out: string) => any
) {
  var options: any = {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  };
  if (env) {
    var base = process.env;
    var pathKey = "PATH";
    options.env = {};
    for (var i in base) {
      if (base.hasOwnProperty(i)) {
        if (i.toLowerCase() === "path")
          pathKey = i;
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

    var err: Error | null = null;

    function exithandler(code, signal) {
      if (exited) return;
      exited = true;

      if (!callback) return;
      callback(err, code, signal, out);
    }

    function errorhandler(e: Error) {
      err = e;
      if (process.stdout)
        process.stdout.destroy();
      if (process.stderr)
        process.stderr.destroy();
      exithandler(-1, null);
    }

    if (process) {
      var append = function(chunk) { out += chunk; };
      if (process.stdout)
        process.stdout.addListener('data', append);
      if (process.stderr)
        process.stderr.addListener('data', append);
      process.addListener('close', exithandler);
      process.addListener('error', errorhandler);
    }
    else {
      err = new Error("could not create child_process object");
      exithandler(-1, null);
    }

  }]);
}

/** Thin wrapper around child_process.spawn */
export function spawn(command: string, args: string[], options: {}, startCallback: (process: child_process.ChildProcess) => any) {
  _runOnceReady(child_process.spawn, arguments);
}

/** Thin wrapper around child_process.fork */
export function fork(modulePath: string, args: string[], options: {}, startCallback: (process: child_process.ChildProcess) => any) {
  _runOnceReady(child_process.fork, arguments);
}

/** Thin wrapper around child_process.exec */
export function exec(
  command: string,
  options: {},
  callback: (error: Error, stdout: Buffer, stderr: Buffer) => void,
  startCallback: (process: child_process.ChildProcess) => any
) {
  _runOnceReady(child_process.exec, arguments);
}

var waitingProcesses = <{fct: any, args: any, cb: any}[]>[];
var nbProcessRunning = 0;
function _run(fct, args, startCallback) {
  nbProcessRunning++;
  // console.trace("Run process", args[0], args[1].join(" "));
  try {
    var ret = fct.apply(child_process, args);
    startCallback(ret);
    var exited = false;
    var cb = function() {
      if (!exited) {
        exited = true;
        _freeOne();
      }
    };
    ret.once('error', cb);
    ret.once('exit', cb);
  } catch (e) {
    startCallback(null);
  }
}


function _runOnceReady(fct, args) {
  args = Array.from(args);
  var cb = args.pop();

  if (nbProcessRunning < maxConcurrentProcess) {
    _run(fct, args, cb);
  }
  else {
    waitingProcesses.push({fct: fct, args: args, cb: cb});
  }
}

function _freeOne() {
  nbProcessRunning--;
  if (waitingProcesses.length > 0) {
    var o = waitingProcesses.shift()!;
    _run(o.fct, o.args, o.cb);
  }
}
