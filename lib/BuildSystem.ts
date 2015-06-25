/// <reference path="../typings/tsd.d.ts" />
'use strict';

require("es6-shim");
require('./core/Logger')(console, 'info');

console.trace("Loading build system");
import Provider = require('./core/Provider');
import Sysroot = require('./core/Sysroot');
import Target = require('./core/Target');
import Task = require('./core/Task');
import path = require('path');
import util = require('./core/util');
import _ = require('underscore');

var BuildSystem : {
  Target : typeof Target;
  Task : typeof Task;
} = {
  Target: Target,
  Task: Task,
};

util.requireDir(path.join(__dirname, './targets'));
util.requireDir(path.join(__dirname, './tasks'));
Sysroot.loadClasses(path.join(__dirname, 'sysroots'));
Sysroot.load(path.join(__dirname, '../sysroots'));

_.extend(global, {
  BuildSystem: BuildSystem,
  _: _
});

// TODO: move this a better place
// This VM provide i386 & x86_64 linker/masm
new Provider.RemoteClient("http://10.0.0.18:2346");
// Default OSX 10.10 compiler & linker
Provider.register(new Provider.Process("clang", { type:"compiler", compiler:"clang", version:"3.6"});
Provider.register(new Provider.Process("libtool", { type:"linker", linker:"libtool", version:"870"}));
// Trunk version of clang for msvc support
Provider.register(new Provider.Process("/Users/vincentrouille/Dev/MicroStep/llvm/build-release/bin/clang", { type:"compiler", compiler:"clang", version:"3.7"}));


export = BuildSystem;
