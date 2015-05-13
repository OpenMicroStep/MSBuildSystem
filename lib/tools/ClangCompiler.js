var CXXCompiler = require('./_CXXCompiler');
var Process = require('../core/Process');
var util = require('util');

function Clang() {
  CXXCompiler.apply(this, arguments);
  this.bin = 'clang';
  this.compileFlags = [];
}

util.inherits(Clang, CXXCompiler);

Clang.newCrossCompiler = function(options) {
  var MyClang = function() {
    Clang.apply(this, arguments);

    if (options.bin         ) this.bin = options.bin;
    if (options.triple      ) this.compileFlags.push("--target=" + options.triple);
    if (options.sysroot     ) this.compileFlags.push("--sysroot=" + options.sysroot);
    if (options.compileFlags) Array.prototype.push.apply(this.compileFlags, options.compileFlags);
  };

  util.inherits(MyClang, Clang);

  return new MyClang();
};

Clang.prototype.name = "clang";

Clang.prototype.buildIncludeFiles = function(srcFile, callback) {
  throw "Must be reimplemented by subclasses";
};


Clang.prototype.compile = function(runner, srcFile, lang, objFile, options, callback) {
  var args = ['-fno-color-diagnostics', '-g'];
  Array.prototype.push.apply(args, this.compileFlags);
  if(options.flags) Array.prototype.push.apply(args, options.flags);
  args.push("-c", srcFile.path);
  args.push("-o", objFile.path);
  Process.run(this.bin, args, callback);
};

Clang.prototype.link = function(objFiles, finalFile, options, callback) {
  var args = [];
  Array.prototype.push.apply(args, this.compileFlags);
  if(options.flags) Array.prototype.push.apply(args, options.flags);
  objFiles.forEach(function(objFile) { args.push(objFile.path); });
  args.push("-o", finalFile.path);
  if(options.afterObjectFlags) Array.prototype.push.apply(args, options.afterObjectFlags);
  Process.run(this.bin, args, callback);
};

module.exports = Clang;