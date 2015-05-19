/// <reference path="../typings/tsd.d.ts" />
require("es6-shim");
require('./core/Logger')(console, 'info');
console.trace("Loading build system");
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
export = BuildSystem;
