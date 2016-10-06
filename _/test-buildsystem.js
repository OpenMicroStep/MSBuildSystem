"use strict";
var core = require('./out-buildsystem/node_modules/@msbuildsystem/core');
core.Loader.loadModules();
console.info("Loaded modules: ", Array.from(core.Loader.modules.values()).map(m => m.name).join(', ')),
core.Loader.modules.forEach(function (module) {
  module.test();
});
