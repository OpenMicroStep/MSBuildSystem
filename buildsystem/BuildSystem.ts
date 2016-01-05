/// <reference path="../typings/tsd.d.ts" />
'use strict';

require('source-map-support').install();
require("es6-shim");
require('./core/Logger')(console, 'info');

console.trace("Loading build system");
export import core = require('./core');
export import Target = require('./core/Target');
export import Task = require('./core/Task');
export import Graph = require('./core/Graph');
export import Workspace = require('./core/Workspace');
import Provider = require('./core/Provider');
import Sysroot = require('./core/Sysroot');
import path = require('path');
export import util = require('./core/util');
import _ = require('underscore');

util.requireDir(path.join(__dirname, './targets'));
util.requireDir(path.join(__dirname, './tasks'));
Sysroot.loadClasses(path.join(__dirname, 'sysroots'));
Sysroot.load(path.join(__dirname, '../sysroots'));


if (process.platform === "darwin") {
  // TODO: add better detection
  // darwin provide clang & libtool with Xcode
  Provider.register(new Provider.Process("clang", { type:"compiler", compiler:"clang", version:"apple/7.0.2"})); // apple is playing this clang version number :(
  Provider.register(new Provider.Process("libtool", { type:"linker", linker:"libtool", version:"apple/877.8"}));
}

