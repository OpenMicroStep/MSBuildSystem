/* @flow weak */
var fs = require('fs');
var path = require('path');

function requireDir(dirPath, postProcess) {
  var dir = fs.readdirSync(dirPath);
  var modules = {};
  dir.forEach(function(module) {
    if(path.extname(module) === '.js' && module[0] !== "_") {
      module = module.substring(0, module.length - 3);
      modules[module] = require(path.join(dirPath, module));
      if(postProcess) postProcess(modules[module], module);
    }
  });
  return modules;
}

module.exports = {
  requireDir : requireDir
};