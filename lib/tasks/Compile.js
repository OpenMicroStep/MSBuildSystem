/* @flow weak */
var ProcessTask = require('./_Process');
var File = require('../core/File');
var util = require('util');

function Compile(srcFile, objFile, compiler)
{
  ProcessTask.call(this, "Compile " + srcFile.name);

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
}
util.inherits(Compile, ProcessTask);

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

Compile.prototype.isRunRequired = function (runner, callback) {
  File.ensure({
    inputs:[this.srcFile],
    outputs:[this.objFile]
  }, callback);
};

Compile.prototype.clean = function (runner, callback) {
  runner.info("unlink", this.objFile.path);
  this.objFile.unlink(callback);
};

module.exports = Compile;