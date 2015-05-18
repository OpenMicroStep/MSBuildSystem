/// <reference path="../../typings/tsd.d.ts" />
/* @flow weak */
import CompileTask = require('./Compile');
import File = require('../core/File');
import LinkTask = require('./Link');

class LinkLibToolTask extends LinkTask {
  constructor(compileTasks: CompileTask[], finalFile: File, options) {
    super(compileTasks, finalFile);
    this.bin = "libtool";
    this.appendArgs(options.target.shared ? "-dynamic" : "-static");
    this.appendArgs("-o", finalFile.path);
    this.appendArgs(this.inputFiles.map(function (file) {
      return file.path;
    }));
  }
}

export = LinkLibToolTask;