var electron = require('electron');
var app = electron.app;  // Module to control application life.
var BrowserWindow = electron.BrowserWindow;  // Module to create native browser window.
var child_process = require('child_process');
var dialog = require('electron').dialog;
var Menu = require('menu');
var UserData = require('../server/UserData');
var async = require('../core/async');
// Report crashes to our server.
//electron.crashReporter.start();

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
var windows = [];

var shouldQuit = app.makeSingleInstance(function(commandLine, workingDirectory) {
  // Someone tried to run a second instance, we should focus our window.
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
  return true;
});
if (shouldQuit) {
  app.quit();
  return;
}


// Quit when all windows are closed.
app.on('window-all-closed', function() {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform != 'darwin') {
    app.quit();
  }
});

app.on('open-file', function(e, path) {
  console.info("open-file", e, path);
});

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.

var userData = new UserData("electron.json");
async.run(null, [
  [
    function(p) {
      app.on('ready', function() {
        p.continue();
      });
    },
    userData.load.bind(userData)
  ],
  onready
]);

var willQuit = false;
app.on('before-quit', function() { willQuit = true; });
var server;
function openWorkspace(workspace) {
  var bounds = workspace.bounds || { x: undefined, y: undefined, width: 800, heigth: 600 };
  // Create the browser window.
  var w = new BrowserWindow({
    x: bounds.x, y: bounds.y,
    width: bounds.width, height: bounds.height,
    'title-bar-style': 'hidden'
  });
  windows.push(w);
  // Open the DevTools.
  //mainWindow.webContents.openDevTools();

  // and load the index.html of the app.
  w.loadURL("file://" + __dirname + "/../client/index-debug.html#" + workspace.path);

  // Emitted when the window is closed.
  function saveBounds() {
    workspace.bounds = w.getBounds();
    async.run(null, userData.save.bind(userData));
  }
  w.on('move', saveBounds);
  w.on('resize', saveBounds);
  w.on('closed', function() {
    var idx;
    if (!willQuit) {
      var workspaces = userData.get("workspaces");
      idx = workspaces.indexOf(workspace);
      if (idx !== -1 && !willQuit) {
        workspaces.splice(idx, 1);
        async.run(null, userData.save.bind(userData));
      }
    }
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    idx = windows.indexOf(w);
    windows.splice(idx, 1);
  });
}

function openWorkspaceDialog() {
  dialog.showOpenDialog({ properties: [ 'openDirectory']}, function(filenames) {
    var workspaces = userData.get("workspaces");
    if (filenames && filenames.length === 1 && workspaces.indexOf(filenames[0]) === -1) {
      var w = {path: filenames[0]};
      workspaces.push(w);
      openWorkspace(w);
      async.run(null, userData.save.bind(userData));
    }
  });
}

function onready(p) {
  if (app.dock) {
    app.dock.setMenu(Menu.buildFromTemplate([
      { label: 'Open workspace', click: openWorkspaceDialog },
    ]));
  }

  server = child_process.fork(__dirname + "/../server/main.js", []);
  console.info("all", userData.all());
  var workspaces = userData.get("workspaces", []);
  if (workspaces.length > 0) {
    workspaces.forEach(function(w) {
      openWorkspace(w);
    });
  }
  else {
    openWorkspaceDialog();
  }
}
