var Task = require('../core/Task');
var File = require('../core/File');
var util = require('util');

function Link(compileTasks, finalFile, linker)
{
  Task.apply(this, arguments);
  this.addDependencies(compileTasks);

  /**
   * Linker to use for linking
   * @type {CXXCompiler}
   */
  this.linker = linker;

  /**
   * Result file of the linking
   * @type {File}
   */
  this.finalFile = finalFile;

  /**
   * List of obj files to link
   * @type {[File]}
   */
  this.objFiles = [];
  var self = this;
  compileTasks.forEach(function(task) {
    self.objFiles.push(task.objFile);
  });

  this.flags = [];
}
util.inherits(Link, Task);

Link.prototype.addFlags = function(flags) {
  Array.prototype.push.apply(this.flags, flags);
};

Link.prototype.run = function (runner, callback) {
  var self = this;
  File.ensure({
    inputs:self.objFiles,
    outputs:[self.finalFile]
  }, function(err, changed) {
    if(err) return callback(err);
    if(!changed) return callback();

    self.linker.link(self.objFiles, self.finalFile, {
      flags: self.flags
    }, callback);
  });

};

Link.prototype.clean = function (runner, callback) {
  runner.info("unlink", this.finalFile.path);
  this.finalFile.unlink(callback);
};


module.exports = Link;