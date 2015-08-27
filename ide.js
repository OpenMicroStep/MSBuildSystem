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

io.on('connection', function(socket){
  var workspace = new Workspace("/Users/vincentrouille/Dev/tmp/Test");
  replication.registerSocket(socket);
  socket.on('rootWorkspace', function(cb) {
    cb(workspace.encode());
  });

});