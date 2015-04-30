require("./core/_ECMAScript6");
//require('./core/Logger')(console, '[mmm dd HH:MM:ss.l]', 'trace');
var fs = require('fs');
var path = require('path');
var Task = require('./core/Task');

function requireDir(dirPath, postProcess) {
  dirPath = path.join(__dirname, dirPath);
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


var BuildSystem = {
  Target : requireDir('./targets'),
  Tool : requireDir('./tools'),
  Task : requireDir('./tasks')
};
module.exports = BuildSystem;
global.BuildSystem = BuildSystem;
global.Barrier = require("./core/Barrier");
global._ = require("underscore");

/**
 * @type {Object.<string, Toolchain>}
 */
BuildSystem.Toolchain = requireDir('../toolchains', function(toolchain, name) {
  toolchain.name = name;
});

/**
 * @class Profile
 * @property  {string} name Name of the profile
 * @property {object} directories
 * @property {string} directories.intermediates Where to put intermediates build files
 * @property {string} directories.output Where to put output file (ie. built libraries, frameworks, ...)
 * @property {string} directories.publicHeaders Where to put public headers (ie. include)
 * @property {Object.<string, string>} directories.target Per target type output directories
 */
/**
 * @type {Object.<string, Profile>}
 */
BuildSystem.Profile = requireDir('../profiles', function(profile, name) {
  profile.name = name;
});

/**
 *
 * @param {object} param
 * @param {string|Target} param.target
 * @param {string|Toolchain} param.toolchain
 * @param callback
 */
BuildSystem.buildTargetTaskGraph = function (param, callback) {
  var targetPath = param.target;
  param.target = require(targetPath);
  param.target.path = targetPath;
  param.target.directory = path.dirname(targetPath);
  param.toolchain = BuildSystem.Toolchain[param.toolchain];
  param.target.buildTaskGraph(param, function(inputs, outputs) {
    callback(new Task.Graph(inputs, outputs));
  });
};


function Context() {

}

BuildSystem.Context = Context;