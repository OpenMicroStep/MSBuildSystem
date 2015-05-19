/// <reference path="../../typings/tsd.d.ts" />
/* @flow weak */
import ProcessTask = require('./_Process');
import File = require('../core/File');
import Task = require('../core/Task');

class CompileTask extends ProcessTask {
  public language: string;
  constructor(srcFile : File, objFile : File) {
    super("Compile " + srcFile.name, [srcFile], [objFile]);
    this.language = CompileTask.extensions[srcFile.extension];
  }

  static extensions =  {
    '.m' : 'OBJC',
    '.c' : 'C',
    '.mm' : 'OBJCXX',
    '.cc' : 'CXX',
    '.S' : 'ASM'
  };
  buildDependency() {
    // clang -M srcFile >
  }
}
Task.registerClass(CompileTask, "Compile");

export = CompileTask;