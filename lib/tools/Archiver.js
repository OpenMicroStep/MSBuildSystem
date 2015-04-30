var CXXCompiler = require('./_CXXCompiler');
var Process = require('../core/Process');
var util = require('util');

function Archiver() {
  this.bin = 'ar';
}

Archiver.newCrossArchiver = function(options) {
  var MyArchiver = function() {
    Archiver.apply(this, arguments);

    if (options.bin         ) this.bin = options.bin;
  };

  util.inherits(MyArchiver, Archiver);

  return new MyArchiver();
};

Archiver.prototype.name = "ar";

Archiver.prototype.link = function(objFiles, finalFile, options, callback) {
  var args = ['rcs'];
  if(options.flags) Array.prototype.push.apply(args, options.flags);
  args.push(finalFile.path);
  objFiles.forEach(function(objFile) { args.push(objFile.path); });
  Process.run(this.bin, args, callback);
};

module.exports = Archiver;