/// <reference path="../../typings/tsd.d.ts" />
/* @flow weak */
import LinkTask = require('./Link');

class LinkBinUtilsTask extends LinkTask {
  constructor(compileTasks, finalFile, options) {
    super(compileTasks, finalFile);
    this.appendArgs(options.target.shared ? "-dynamic" : "-static");
    this.appendArgs("-o", finalFile.path);
    this.appendArgs(this.inputFiles.map(function (file) {
      return file.path;
    }));
  }
}

export = LinkBinUtilsTask;