/* @flow weak */
var ProcessTask = require('./_Process');
var File = require('../core/File');
var util = require('util');
var _ = require('underscore');

function LinkTask(compileTasks, finalFile, options)
{
  ProcessTask.call(this, "Link to " + finalFile.name);
  this.addDependencies(compileTasks);

  /**
   * Result file of the linking
   * @type {File}
   */
  this.finalFile = finalFile;

  /**
   * List of obj files to link
   * @type {[File]}
   */
  this.objFiles = _.map(compileTasks, function(task) { return task.objFile; });
}

util.inherits(LinkTask, ProcessTask);

LinkTask.prototype.isRunRequired = function (runner, callback) {
  File.ensure({
    inputs:self.objFiles,
    outputs:[self.finalFile]
  }, callback);
};

LinkTask.prototype.clean = function (runner, callback) {
  runner.info("unlink", this.finalFile.path);
  this.finalFile.unlink(callback);
};

module.exports = LinkTask;