var BuildSystem = require('../../buildsystem/BuildSystem');
var Session = require('./Session');
var replication = require('./replication');
var express = require('express');
var app = express();
var socketio = require('socket.io');
var crypto = require('crypto');
app.use(express.static(__dirname + '/../'));

var server = app.listen(3000, "127.0.0.1", function () {
  var host = server.address().address;
  var port = server.address().port;

  console.info('IDE server is listening at http://%s:%s', host, port);
});
var io = socketio.listen(server);

io.on('connection', function(socket) {
  var info = replication.registerSocket(socket);
  socket.on('getsession', function(sessionid, cb) {
    if (!(/^\w+$/.test(sessionid))) {
      var hash = crypto.createHash('sha256');
      hash.update(sessionid);
      sessionid = hash.digest('hex');
    }
    var session = new Session(sessionid);
    console.info("New session:" + sessionid);
    cb(replication.encode(info, session));
  });
});

app.get('/file/:path', function(req, res) {
  console.info("file requested", req.params.path);
  res.download(req.params.path);
});