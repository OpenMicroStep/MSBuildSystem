/// <reference path="../typings/tsd.d.ts" />
'use strict';

require('source-map-support').install();
require("es6-shim");
require('./core/Logger')(console, 'info');

console.trace("Loading build system");
export import Target = require('./core/Target');
export import Task = require('./core/Task');
export import Graph = require('./core/Graph');
export import Workspace = require('./core/Workspace');
import Provider = require('./core/Provider');
import Sysroot = require('./core/Sysroot');
import path = require('path');
import util = require('./core/util');
import _ = require('underscore');

util.requireDir(path.join(__dirname, './targets'));
util.requireDir(path.join(__dirname, './tasks'));
Sysroot.loadClasses(path.join(__dirname, 'sysroots'));
Sysroot.load(path.join(__dirname, '../../sysroots'));

