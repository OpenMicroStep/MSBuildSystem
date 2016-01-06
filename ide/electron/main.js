var electron = require('electron');
var app = electron.app;  // Module to control application life.
var BrowserWindow = electron.BrowserWindow;  // Module to create native browser window.
var child_process = require('child_process');
var dialog = require('electron').dialog;
// Report crashes to our server.
//electron.crashReporter.start();

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
var mainWindow;

// Quit when all windows are closed.
app.on('window-all-closed', function() {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform != 'darwin') {
    app.quit();
  }
});

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
app.on('ready', function() {
  if (process.argv.length < 3) {
    dialog.showOpenDialog({ properties: [ 'openDirectory']}, function(filenames) {
      if (filenames && filenames.length === 1)
        openWorkspace(filenames[0]);
      else
        process.exit(1);
    });
  }
  else {
    openWorkspace(process.argv[process.argv.length - 1]);
  }

  function openWorkspace(path) {
    var child = child_process.fork(__dirname + "/../server/main.js", [path]);

    // Create the browser window.
    mainWindow = new BrowserWindow({width: 800, height: 600, 'title-bar-style': 'hidden'});

    // Open the DevTools.
    //mainWindow.webContents.openDevTools();

    // and load the index.html of the app.
    mainWindow.loadURL("file://" + __dirname + "/../client/index-debug.html");

    // Emitted when the window is closed.
    mainWindow.on('closed', function() {
      // Dereference the window object, usually you would store windows
      // in an array if your app supports multi windows, this is the time
      // when you should delete the corresponding element.
      mainWindow = null;
      child.kill();
    });
  }
});
