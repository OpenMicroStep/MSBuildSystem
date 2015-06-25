/**
 * Provide a remote service that allow a builder to use some services.
 * To run this service, only nodejs is required.
 *
 * !!! For now there is no authentication system !!!
 */

var net = require('net');
var fs = require('fs');
var path = require('path');
var os = require('os');

var CommandSuccess = 1;
var CommandError = 2;
// Commands 16-1023
var CommandPutFile = 16;
var CommandMkDir = 17;
var CommandGetPlaygroundPath = 18;
var CommandRunGDBServer = 19;
var CommandRunProcess = 20;
var CommandRecursiveCopy = 21;
// SubCommands 1024-
var CommandPutFileData = 1024;
var CommandPutFileDone = 1025;
var CommandProcessStdIn = 1026;
var CommandProcessStdOut = 1027;
var CommandProcessStdErr = 1028;
var CommandProcessTerminate = 1029;

function commandTypeIsMainCommand(type) {
  return 16 <= type && type <= 1023;
}

function ensureDirectoryExists(dirpath, callback) {
  var dirs = dirpath.split(/[\/\\]+/g);
  var idx = 0;
  var currentdir = "";

  fs.exists(dirpath, function(exists) {
    if(exists)
      callback(null);
    else
      ensureCurrentDirExists();
  });

  function ensureCurrentDirExists() {
    if (idx < dirs.length) {
      currentdir += dirs[idx++] + path.sep;
      fs.exists(currentdir, function(exists) {
        if(!exists) {
          //noinspection OctalIntegerJS
          fs.mkdir(currentdir, 0777, function(err) {
            if (err && err.code != 'EEXIST')
              callback(err.code);
            else
              ensureCurrentDirExists();
          });
        }
        else {
          ensureCurrentDirExists();
        }
      });
    }
    else {
      callback(null);
    }
  }
}
function copy(srcpath, dstpath, callback) {
  fs.lstat(srcpath, function(err, stats) {
    if(err) return callback(err);
    if(stats.isDirectory()) {
      copyDirectory(srcpath, dstpath, callback);
    } else if(stats.isFile()) {
      ensureDirectoryExists(path.dirname(dstpath), function(err) {
        if(err) return callback(err);
        copyFile(srcpath, dstpath, callback);
      });
    } else {
      callback(err);
    }
  });
}

function copyFile(srcpath, dstpath, callback) {
  var readStream = null;
  //noinspection OctalIntegerJS
  var writeStream = fs.createWriteStream(dstpath, {
    flags: 'w',
    encoding: null,
    mode: 0770
  });
  writeStream.on('error', function(err) {
    writeStream.removeAllListeners();
    if(readStream) {
      readStream.removeAllListeners();
      readStream.close();
    }
    callback("writeStream" + err);
  });
  writeStream.on('open', function() {
    readStream = fs.createReadStream(srcpath);
    readStream.on('error', function(err) {
      readStream.removeAllListeners();
      writeStream.removeAllListeners();
      writeStream.end();
      callback("readStream" + err);
    });
    readStream.pipe(writeStream);
  });
  writeStream.once('finish', function() {
    readStream.removeAllListeners();
    writeStream.removeAllListeners();
    callback();
  });
}

function copyDirectory(srcpath, dstpath, callback) {
  ensureDirectoryExists(dstpath, function(err) {
    if(err) return callback(err);
    fs.readdir(srcpath, function(err, files) {
      if(err) return callback(err);

      var i = 0, file;
      copyDirectoryStep();

      function copyDirectoryStep(err) {
        if(err) return callback(err);
        if(i < files.length) {
          file = files[i];
          ++i;
          copy(srcpath + path.sep + file, dstpath + path.sep + file, copyDirectoryStep);
        } else {
          callback();
        }
      }
    })
  });
}

function splitBuffer(buffer) {
  var start = 0;
  var args = [];
  for(var i = 0; i < buffer.length; ++i) {
    if(buffer[i] === 0 && start < i) {
      args.push(buffer.toString('utf8', start, i));
      start = i + 1;
    }
  }

  return args;
}

var metasize = 6; // sizeof(id) + sizeof(type) + sizeof(size)

var server = net.createServer({});
server.on('connection', function(socket) {
  var commandListeners = {};
  var message = null;
  var meta = new Buffer(metasize);
  var metapos = 0;
  var datapos = 0;
  var client = socket.remoteAddress + ":" + socket.remotePort;
  console.log('Client connected', client);

  socket.on('data', function(buffer) {
    var consumed = 0;
    var consuming;
    while (consumed < buffer.length) {
      if (metapos < metasize) {
        // We were waiting for more metadata
        consuming = Math.min(buffer.length - consumed, metasize - metapos);
        buffer.copy(meta, metapos, consumed, consumed + consuming);
        metapos += consuming;
        consumed += consuming;

        if (metapos === metasize) {
          message = {
            id: meta.readUInt16BE(0),
            type: meta.readUInt16BE(2),
            size: meta.readUInt16BE(4),
            data: null
          };
          //console.log("recv id="+message.id+", type="+message.type+", size="+message.size);
          message.data = new Buffer(message.size);
        }
      }

      if (metapos === metasize) {
        // We are waiting for data
        if (datapos < message.size && consumed < buffer.length) {
          consuming = Math.min(buffer.length - consumed, message.size - datapos);
          buffer.copy(message.data, datapos, consumed, consumed + consuming);
          datapos += consuming;
          consumed += consuming;
        }
        if (datapos == message.size) {
          // Message is received
          try {
            if (commandTypeIsMainCommand(message.type))
              handleNewCommand(message);
            else if (message.id in commandListeners)
              commandListeners[message.id](message);
          } catch(e) {
            console.log("exception thrown while handling ", message, " : ", e);
          }
          datapos = 0;
          metapos = 0;
        }
      }
    }
  });

  socket.on('end', function() {
    console.log('Client disconnected', client);
    socket = null;
  });

  socket.on('error', function(error) {
    if(error.code)
      console.log('Client disconnected', client, error.code);
    else
      console.log('socket error', error);
  });

  function socketSend(id, type, data) {
    if(!socket)
      return;
    try {
      if(typeof data === "string")
        data = new Buffer(data, 'utf8');

      var length = data ? data.length : 0;
      while(length > 65535) {
        socketSend(id, type, data.slice(0, 65535));
        data = data.slice(65535);
        length = data.length;
      }

      var metaout = new Buffer(metasize);
      metaout.writeUInt16BE(id, 0);
      metaout.writeUInt16BE(type, 2);
      metaout.writeUInt16BE(length, 4);

      //console.log("send id="+id+", type="+type+", size="+(data ? data.length : 0), metaout);
      if(type === CommandError)
        console.log("Sending error to "+client+" : " +data.toString());
      socket.write(metaout);
      if (data)
        socket.write(data);
    } catch(e) {
      console.log('socket send error', e);
    }
  }

  function handleNewCommand(message) {
    switch (message.type) {
      case CommandGetPlaygroundPath:
        socketSend(message.id, CommandSuccess, process.cwd());
        break;

      case CommandPutFile:
        handlePutFile(message);
        break;

      case CommandRunGDBServer:
        if (/^win/.test(os.platform()))
          handleRunProcess(message, ["C:\\MinGW\\bin\\gdbserver.exe", "--once", "--multi" , "0.0.0.0:2345"]);
        else
          handleRunProcess(message, ["gdbserver", "--once", "--multi" , "0.0.0.0:2345"]);
        break;

      case CommandRunProcess:
        handleRunProcess(message);
        break;

      case CommandMkDir:
        ensureDirectoryExists(message.data.toString('utf8'), function(err) {
          if (err)
            socketSend(message.id, CommandError, "ensure directory exists failed, " + err);
          else
            socketSend(message.id, CommandSuccess, null);
        });
        break;

      case CommandRecursiveCopy:
        handleRecursiveCopy(message);
        break;

      default:
        break;
    }
  }

  function handleRecursiveCopy(message) {
    var args = splitBuffer(message.data);
    if(args.length >= 2) {
      copy(path.resolve(args[0]), path.resolve(args[1]), function(err) {
        if (err) socketSend(message.id, CommandError, "copy failed, " + err);
        else socketSend(message.id, CommandSuccess, null);
      });
    }
    else {
      socketSend(message.id, CommandError, "parameters are invalid, 2 string terminated by a \\0 char were expected");
    }
  }

  function handlePutFile(message) {
    var filepath = message.data.toString('utf8');
    var waitingmsgs = [];

    commandListeners[message.id] = function(message) {
      if (message.type === CommandPutFileData || message.type === CommandPutFileDone)
        waitingmsgs.push(message);
    };
    ensureDirectoryExists(path.dirname(filepath), function(err) {
      if (err) {
        socketSend(message.id, CommandError, "ensure directory exists failed, " + err);
        return;
      }
      //noinspection OctalIntegerJS
      var stream = fs.createWriteStream(filepath, {
        flags: 'w',
        encoding: null,
        mode: 0770
      });
      stream.on('open', function(fd) {
        commandListeners[message.id] = function(message) {
          if (message.type === CommandPutFileData)
            stream.write(message.data);
          else if (message.type === CommandPutFileDone)
            stream.end(message.data);
        };
        waitingmsgs.forEach(commandListeners[message.id]);
        waitingmsgs = null;
      });
      stream.on('finish', function() {
        delete commandListeners[message.id];
        socketSend(message.id, CommandSuccess, null);
      });
      stream.on('error', function(err) {
        delete commandListeners[message.id];
        socketSend(message.id, CommandError, "write stream error, " + err);
      });
    });
  }

  function handleRunProcess(message, args) {
    if(!args)
      args = splitBuffer(message.data);
    var command = args.shift();
    var child = require('child_process').spawn(command, args);

    commandListeners[message.id] = function(message) {
      if (message.type === CommandProcessStdIn)
        child.stdin.write(message.data);
      else if (message.type === CommandProcessTerminate)
        child.kill();
    };
    child.stdout.on('data', function(buffer) {
      socketSend(message.id, CommandProcessStdOut, buffer);
    });
    child.stderr.on('data', function(buffer) {
      socketSend(message.id, CommandProcessStdErr, buffer);
    });
    child.on('exit', function(code, signal) {
      delete commandListeners[message.id];
      if (code !== null) {
        var exitcode = new Buffer(4);
        exitcode.writeUInt32BE(code, 0);
        socketSend(message.id, CommandSuccess, exitcode);
      }
      else if (signal !== null) {
        socketSend(message.id, CommandError, "process exited with signal, " + signal);
      }
      else {
        socketSend(message.id, CommandError, "process exited with unknown error");
      }
    });
    child.on('error', function(err) {
      delete commandListeners[message.id];
      socketSend(message.id, CommandError, "run process error, " + err);
    });
  }
}); //end server.on('')

server.on('listening', function() {
  var addr = server.address();
  console.log("Xcode plugin service listening at", addr.address + ":" + addr.port);
});

server.on('error', function(error) {
  if (error.code == 'EADDRINUSE') {
    console.log('Address in use, exiting');
  } else {
    console.log('server error', error);
  }
});

server.listen(process.env.PORT || 2346, process.env.IP || "0.0.0.0");
