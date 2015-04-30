var util = require('util');
var path = require('path');

var CXXCompiler = require('./_CXXCompiler');
var Process = require('../core/Process');

function GCC() {
  CXXCompiler.apply(this, arguments);
  this.bin = 'gcc';
  this.compileFlags = [];
}

util.inherits(GCC, CXXCompiler);

GCC.newCrossCompiler = function(options) {
  var MyGCC = function() {
    GCC.apply(this, arguments);

    if (options.bin         ) this.bin = options.bin;
    if (options.triple      ) this.compileFlags.push("--target=" + options.triple);
    if (options.sysroot     ) this.compileFlags.push("--sysroot=" + options.sysroot);
    if (options.compileFlags) Array.prototype.push.apply(this.compileFlags, options.compileFlags);
    if (options.sysroot    &&
        options.triple     &&
        !options.bin        ) this.bin = path.join(options.sysroot, "bin", options.triple + "-gcc");
  };
  util.inherits(MyGCC, GCC);

  return new MyGCC();
};

GCC.prototype.name = "gcc";

GCC.prototype.buildIncludeFiles = function(srcFile, callback) {
  throw "Must be reimplemented by subclasses";
};


GCC.prototype.compile = function(srcFile, lang, objFile, options, callback) {
  throw "Must be reimplemented by subclasses";
};

GCC.prototype.link = function(objFiles, finalFile, options, callback) {
  var args = [];
  Array.prototype.push.apply(args, this.compileFlags);
  if(options.flags) Array.prototype.push.apply(args, options.flags);
  objFiles.forEach(function(objFile) { args.push(objFile.path); });
  args.push("-o", finalFile.path);
  Process.run(this.bin, args, callback);
};


module.exports = GCC;