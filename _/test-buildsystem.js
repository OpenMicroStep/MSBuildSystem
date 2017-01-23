"use strict";
const core = require('./bootstrap6/node/debug/node_modules/@msbuildsystem/core');
core.Loader.loadModules();
console.info("Loaded modules: ", Array.from(core.Loader.modules.values()).map(m => m.name).join(', ')),
core.Async.run(null, (f) => { core.Loader.testModules(f); });
