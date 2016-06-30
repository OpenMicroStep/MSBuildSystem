import {loadModules, modules} from './loader';

loadModules();
modules.forEach((exports, name) => {
  if (exports.tests) {
      exports.tests();
  }
});
