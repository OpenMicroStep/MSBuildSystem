var Task = require('../core/Task');
var File = require('../core/File');
var util = require('util');

function Compile(srcFile, objFile, compiler)
{
  Task.apply(this, arguments);

  /**
   * @type {File}
   */
  this.srcFile = srcFile;

  /**
   * @type {File}
   */
  this.objFile = objFile;

  /**
   * @type {CXXCompiler}
   */
  this.compiler = compiler;

  /**
   * List of File this task depends on.
   * If any of the file changes, then this task must be run again
   * @type {Array}
   */
  this.inputs = [];

  this.flags = [];
}
util.inherits(Compile, Task);

Compile.extensions = {
  '.m' : 'C',
  '.c' : 'C',
  '.mm' : 'CXX',
  '.cc' : 'CXX',
  '.S' : 'ASM'
};

Compile.prototype.buildDependency = function() {
  // clang -M srcFile >
};

Compile.prototype.addFlags = function(flags) {
  Array.prototype.push.apply(this.flags, flags);
};

Compile.prototype.run = function (runner, callback) {
  var self = this;
  File.ensure({
    inputs:[self.srcFile],
    outputs:[self.objFile]
  }, function(err, changed) {
    if(err) return callback(err);
    if(!changed) return callback();

    self.compiler.compile(self.srcFile, Compile.extensions[self.srcFile.extension], self.objFile, {
      flags: self.flags
    }, callback);
  });
};

Compile.prototype.clean = function (runner, callback) {
  runner.info("unlink", this.objFile.path);
  this.objFile.unlink(callback);
};


module.exports = Compile;