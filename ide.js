var BuildSystem = require('./out/buildsystem/BuildSystem');
var Workspace = require('./out/ide/server/Workspace');
var replication = require('./out/ide/server/replication');
var express = require('express');
var app = express();
var socketio = require('socket.io');
app.use(express.static('.'));

var server = app.listen(3000, function () {
  var host = server.address().address;
  var port = server.address().port;

  console.log('IDE server is listening at http://%s:%s', host, port);
});
var io = socketio.listen(server);

// This VM provide i386 & x86_64 linker/masm
var Provider = require('./out/buildsystem/core/Provider');

// TODO: move this a better place
// Default OSX 10.10 compiler & linker
Provider.register(new Provider.Process("clang", { type:"compiler", compiler:"clang", version:"3.6"}));
Provider.register(new Provider.Process("libtool", { type:"linker", linker:"libtool", version:"870"}));

var workspace = new Workspace("/Users/vincentrouille/Dev/MicroStep/MSFoundation");
io.on('connection', function(socket){
  console.info("New connection");
  var info = replication.registerSocket(socket);
  socket.on('rootWorkspace', function(cb) {
    cb(replication.encode(info, workspace));
  });
});