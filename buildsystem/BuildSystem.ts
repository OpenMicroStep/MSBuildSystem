require('source-map-support').install();
require("es6-shim");
require('./core/Logger')(console, 'info');

console.trace("Loading build system");
export import core = require('./core');
export import Target = require('./core/Target');
export import Task = require('./core/Task');
export import Graph = require('./core/Graph');
export import Workspace = require('./core/Workspace');
export import Provider = require('./core/Provider');
import Sysroot = require('./core/Sysroot');
import path = require('path');
export import util = require('./core/util');
import _ = require('underscore');

util.requireDir(path.join(__dirname, './targets'));
util.requireDir(path.join(__dirname, './tasks'));
Sysroot.loadClasses(path.join(__dirname, 'sysroots'));
Sysroot.load(path.join(__dirname, '../sysroots'));

var p, fs = require('fs');
function ifexists(path, cb) {
  var stats = null;
  try {
    stats = fs.statSync(path);
  } catch(e) {};
  if (stats) cb();
}

console.info("Looking for providers");

if (process.platform === "darwin") {
  // TODO: add better detection
  // darwin provide clang & libtool with Xcode
  Provider.register(new Provider.Process("clang", { type:"compiler", compiler:"clang", version:"apple/7.0.2"})); // apple is playing this clang version number :(
  Provider.register(new Provider.Process("libtool", { type:"linker", linker:"libtool", version:"apple/877.8"}));
}
else if (process.platform === "win32") {
  // WO451
  ifexists(p= "C:/Apple/Developer/Executables/gcc.exe", function() {
    Provider.register(new Provider.Process(p, { type:"compiler", compiler:"gcc", arch:"i386", version:"wo451" }, {}));
  });
  ifexists(p= "C:/Apple/Library/Executables/sh.exe", function() {
    Provider.register(new Provider.Process(p, { type:"linker", linker:"libtool", arch:"i386", version:"wo451" }, {
      args: ["C:/Apple/Developer/Executables/libtool"]
    }));
  });
  ifexists(p= "C:/Apple/Developer/Executables/LINK.exe", function() {
    Provider.register(new Provider.Process(p, { type:"linker", linker:"msvc", arch:"i386", version:"wo451" }, {}));
  });
  ifexists(p= "C:/Apple/Developer/Executables/LIB.exe", function() {
    Provider.register(new Provider.Process(p, { type:"archiver", archiver:"msvc", arch:"i386", version:"wo451" }, {}));
  });

  // MSVC 11 32bits
  ifexists(p= "C:/Program Files (x86)/Microsoft Visual Studio 11.0/VC/bin/link.exe", function() {
    Provider.register(new Provider.Process(p, { type:"linker", linker:"msvc", arch:"i386", version:"12"}, {
      args: ["/libpath:C:/Program Files (x86)/Microsoft Visual Studio 11.0/VC/lib", "/libpath:C:/Program Files (x86)/Microsoft SDKs/Windows/v7.1A/Lib"],
      PATH: ["C:/Program Files (x86)/Microsoft Visual Studio 11.0/VC/BIN", "C:/Program Files (x86)/Microsoft Visual Studio 11.0/Common7/IDE"]
    }));
  });
  ifexists(p= "C:/Program Files (x86)/Microsoft Visual Studio 11.0/VC/bin/ml.exe", function() {
    Provider.register(new Provider.Process(p, { type:"assembler", assembler:"msvc", arch:"i386", version:"12"}, {
      PATH: ["C:/Program Files (x86)/Microsoft Visual Studio 11.0/VC/BIN", "C:/Program Files (x86)/Microsoft Visual Studio 11.0/Common7/IDE"]
    }));
  });
  ifexists(p= "C:/Program Files (x86)/Microsoft Visual Studio 11.0/VC/bin/lib.exe", function() {
    Provider.register(new Provider.Process(p, { type:"archiver", archiver:"msvc", arch:"i386", version:"12"}, {
      PATH: ["C:/Program Files (x86)/Microsoft Visual Studio 11.0/VC/BIN", "C:/Program Files (x86)/Microsoft Visual Studio 11.0/Common7/IDE"]
    }));
  });
  ifexists(p= "C:/Program Files (x86)/Microsoft Visual Studio 11.0/VC/bin/dumpbin.exe", function() {
    Provider.register(new Provider.Process(p, { type:"dumpbin", arch:"i386", version:"12"}, {
      PATH: ["C:/Program Files (x86)/Microsoft Visual Studio 11.0/VC/BIN", "C:/Program Files (x86)/Microsoft Visual Studio 11.0/Common7/IDE"]
    }));
  });

  // MSVC 11 64bits
  ifexists(p= "C:/Program Files (x86)/Microsoft Visual Studio 11.0/VC/bin/x86_amd64/link.exe", function() {
    Provider.register(new Provider.Process(p, { type:"linker", linker:"msvc", arch:"x86_64", version:"12"}, {
      args: ["/libpath:C:/Program Files (x86)/Microsoft Visual Studio 11.0/VC/lib/amd64", "/libpath:C:/Program Files (x86)/Microsoft SDKs/Windows/v7.1A/Lib/x64"],
      PATH: ["C:/Program Files (x86)/Microsoft Visual Studio 11.0/VC/BIN/x86_amd64", "C:/Program Files (x86)/Microsoft Visual Studio 11.0/Common7/IDE"]
    }));
  });
  ifexists(p= "C:/Program Files (x86)/Microsoft Visual Studio 11.0/VC/bin/x86_amd64/ml64.exe", function() {
    Provider.register(new Provider.Process(p, { type:"assembler", assembler:"msvc", arch:"x86_64", version:"12"}, {
      PATH: ["C:/Program Files (x86)/Microsoft Visual Studio 11.0/VC/BIN/x86_amd64", "C:/Program Files (x86)/Microsoft Visual Studio 11.0/Common7/IDE"]
    }));
  });
  ifexists(p= "C:/Program Files (x86)/Microsoft Visual Studio 11.0/VC/bin/x86_amd64/lib.exe", function() {
    Provider.register(new Provider.Process(p, { type:"archiver", archiver:"msvc", arch:"x86_64", version:"12"}, {
      PATH: ["C:/Program Files (x86)/Microsoft Visual Studio 11.0/VC/BIN/x86_amd64", "C:/Program Files (x86)/Microsoft Visual Studio 11.0/Common7/IDE"]
    }));
  });
  ifexists(p= "C:/Program Files (x86)/Microsoft Visual Studio 11.0/VC/bin/x86_amd64/dumpbin.exe", function() {
    Provider.register(new Provider.Process(p, { type:"dumpbin", arch:"x86_64", version:"12"}, {
      PATH: ["C:/Program Files (x86)/Microsoft Visual Studio 11.0/VC/BIN/x86_amd64", "C:/Program Files (x86)/Microsoft Visual Studio 11.0/Common7/IDE"]
    }));
  });
}

