require("./core/_ECMAScript6");
//require('./core/Logger')(console, '[mmm dd HH:MM:ss.l]', 'trace');
var fs = require('fs');
var path = require('path');
var Task = require('./core/Task');
var util = require('./core/util');

var BuildSystem = {
  Target : util.requireDir(path.join(__dirname, './targets')),
  Tool : util.requireDir(path.join(__dirname, './tools')),
  Task : util.requireDir(path.join(__dirname, './tasks')),
  Sysroot : require('./core/Sysroot')
};
module.exports = BuildSystem;
global.BuildSystem = BuildSystem;
global.Barrier = require("./core/Barrier");
global._ = require("underscore");

// Load toolchains
BuildSystem.Sysroot.loadClasses(path.join(__dirname, 'sysroots'));
BuildSystem.Sysroot.load(path.join(__dirname, '../sysroots'));
