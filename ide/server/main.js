var BuildSystem = require('../../buildsystem/BuildSystem');
var Workspace = require('./Workspace');
var replication = require('./replication');
var express = require('express');
var app = express();
var socketio = require('socket.io');
app.use(express.static(__dirname + '/../'));

var server = app.listen(3000, function () {
  var host = server.address().address;
  var port = server.address().port;

  console.info('IDE server is listening at http://%s:%s', host, port);
});
var io = socketio.listen(server);

io.on('connection', function(socket){
  console.info("New connection");
  var info = replication.registerSocket(socket);
  socket.on('rootWorkspace', function(path, cb) {
    console.info("rootWorkspace", path);
    var workspace = Workspace.getShared(path);
    cb(replication.encode(info, workspace));
  });
});