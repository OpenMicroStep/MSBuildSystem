"use strict";
var core = require('./out-buildsystem/node_modules/@msbuildsystem/core');
core.Loader.loadModules();
core.Loader.modules.forEach(function (module) {
  module.test();
});
