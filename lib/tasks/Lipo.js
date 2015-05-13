/* @flow weak */
var Task = require('../core/Task');
var util = require('util');
var Process = require('../core/Process');

function LipoTask(linkTasks, finalFile)
{
  Task.apply(this, arguments);
  this.addDependencies(linkTasks);

  /**
   * Result file of the merge
   * @type {File}
   */
  this.finalFile = finalFile;

  /**
   * List of arch dependent files to merge
   * @type {[File]}
   */
  this.archFinalFiles = [];
  var self = this;
  linkTasks.forEach(function(task) {
    self.archFinalFiles.push(task.finalFile);
  });

}
util.inherits(LipoTask, Task);

LipoTask.prototype.run = function (runner, callback) {
  var args = [];
  args.push("-create");
  this.archFinalFiles.forEach(function(file) {
    args.push(file.path);
  });
  args.push("-output", this.finalFile.path);
  Process.run("lipo", args,callback);
};

LipoTask.prototype.clean = function (runner, callback) {
  runner.info("unlink", this.finalFile.path);
  this.finalFile.unlink(callback);
};


module.exports = LipoTask;