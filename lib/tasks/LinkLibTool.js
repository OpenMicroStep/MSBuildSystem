/* @flow weak */
var LinkTask = require('./Link');
var util = require('util');
var _ = require('underscore');

function LinkLibToolTask(compileTasks, finalFile, options) {
  LinkTask.apply(this, arguments);

  this.appendArgs(options.target.shared ? "-dynamic" : "-static");
  this.appendArgs("-o",this.finalFile.path);
  this.appendArgs(_.map(this.objFiles, function(file) { return file.path; }));
}

util.inherits(LinkLibToolTask, LinkTask);

module.exports = LinkLibToolTask;