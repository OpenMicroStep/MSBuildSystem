var CXXTarget = require('./_CXXTarget');
var util = require('util');

function Executable()
{
  CXXTarget.apply(this, arguments);
}

util.inherits(Executable, CXXTarget);

Executable.prototype.buildLinkFinalName = function(options) {
  var name = this.name;
  if(options.toolchain.platform === "win32")
    name += ".exe";
  return name;
};

module.exports = Executable;
