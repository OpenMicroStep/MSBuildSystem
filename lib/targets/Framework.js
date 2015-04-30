var Library = require('./Library');
var CXXTarget = require('./_CXXTarget');
var util = require('util');
var path = require('path');

function Framework()
{
  Library.apply(this, arguments);
  this.shared = true; // Framework are always shared libs
  this.publicHeadersPrefix = null;
}

util.inherits(Framework, Library);


Framework.prototype.exports = function(selfOptions, target, targetOptions, callback) {
  target.addCompileMiddleware(function (options, task, next) {
    task.addFlags(['-F' + selfOptions.targetOutput]);
    next();
  });
  target.addLinkMiddleware(function (options, task, next) {
    task.addFlags(['-F' + selfOptions.targetOutput, '-framework', selfOptions.target.name]);
    next();
  });
  CXXTarget.prototype.exports.call(this, selfOptions, target, targetOptions, callback);
};

Framework.prototype.buildLinkFinalPath = function(options) {
  var name = this.name;
  if(options.toolchain.platform === "win32")
    name += ".dll";
  return path.join(options.targetOutput, this.name + ".framework", name);
};

Framework.prototype.buildPublicHeaderPath = function(options) {
  return path.join(options.targetOutput, this.name + ".framework", "Headers");
};

module.exports = Framework;
