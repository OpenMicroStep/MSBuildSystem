/* @flow weak */
var Task = require('../core/Task');
var util = require('util');
var fs = require('fs-extra');
var path = require('path');
var File = require('../core/File');
var Barrier = require('../core/Barrier');

function Copy()
{
  Task.call(this, "Copy");

  this.steps = [];
}
util.inherits(Copy, Task);

/**
 * Make this task copy files 'inFiles' to the directory 'outDir'
 * @param {[string]} inFiles
 * @param {string} outDir
 */
Copy.prototype.willCopyFilesToDir = function(inFiles, outDir) {
  var self = this;
  inFiles.forEach(function(file) {
    self.willCopyFile(file, path.join(outDir, path.basename(file)));
  });
};

/**
 * Make this task copy file 'inFile' to 'outFile'
 * @param {string} inFile
 * @param {string} outFile
 */
Copy.prototype.willCopyFile = function(inFile, outFile) {
  this.steps.push([File.getShared(inFile), File.getShared(outFile)]);
};

Copy.prototype.run = function (runner, callback) {
  var barrierCb = Barrier.createSimpleCb(this.steps.length, function(err) {
    callback(err);
  });
  var self = this;
  this.steps.forEach(function(step) {
    runner.info(self._id, "copy", step[0].path, "to", step[1].path);
    fs.copy(step[0].path, step[1].path, { replace: true }, barrierCb);
  });
};

Copy.prototype.clean = function (runner, callback) {
  var barrierCb = Barrier.createSimpleCb(this.steps.length, function(err) {
    callback(err);
  });
  this.steps.forEach(function(step) {
    runner.info("unlink", step[1].path);
    step[1].unlink(barrierCb);
  });
};

/**
 * @type {Copy|function}
 */
module.exports = Copy;