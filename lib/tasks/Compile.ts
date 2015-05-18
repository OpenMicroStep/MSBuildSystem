/// <reference path="../../typings/tsd.d.ts" />
/* @flow weak */
import ProcessTask = require('./_Process');
import File = require('../core/File');

class Compile extends ProcessTask {
  public language: string;
  constructor(srcFile : File, objFile : File) {
    super("Compile " + srcFile.name, [srcFile], [objFile]);
    this.language = Compile.extensions[srcFile.extension];
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

export = Compile;