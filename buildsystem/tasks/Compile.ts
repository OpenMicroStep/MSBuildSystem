/// <reference path="../../typings/tsd.d.ts" />
/* @flow weak */
'use strict';

import ProcessTask = require('./_Process');
import File = require('../core/File');
import Task = require('../core/Task');
import Graph = require('../core/Graph');
import Provider = require('../core/Provider');
import Barrier = require('../core/Barrier');
import Process = require('../core/Process');

class CompileTask extends ProcessTask {
  public language: string;
  hmapFile: File;
  constructor(graph: Graph, srcFile : File, objFile : File, provider: Provider.Conditions ) {
    super({type: "compile", name: srcFile.name}, graph, [srcFile], [objFile], provider);
    this.language = CompileTask.extensions[srcFile.extension];
    this.hmapFile = File.getShared(objFile.path + ".hmap");
    this.outputFiles.push(this.hmapFile);
    this.addHeaderMapArgs();
  }

  static extensions =  {
    '.m' : 'OBJC',
    '.c' : 'C',
    '.mm' : 'OBJCXX',
    '.cc' : 'CXX',
    '.cpp' : 'CXX',
    '.s' : 'ASM',
    '.S' : 'ASM',
    '.asm' : 'ASM'
  };
  addHeaderMapArgs() {
    this.appendArgs(["-MMD", "-MF", this.hmapFile.path]);
  }

  parseHeaderMap(cb: () => any) {
    this.hmapFile.readUtf8File((err, content) => {
      if(err) return cb();
      var headers = [];
      var lines = content.split("\n");
      for(var i = 1, len = lines.length; i <len; ++i) {
        var header = lines[i];
        if(header.endsWith("\\"))
          header = header.substring(0, header.length - 1).trim();
        else
          header = header.trim();
        if(header.length)
          headers.push(header);
      }
      this.sharedData.headers = headers;
      cb();
    })
  }
  runProcess(provider, callback) {
    super.runProcess(provider, (err, output) => {
      this.parseHeaderMap(() => {
        callback(err, output);
      });
    });
  }

  isRunRequired(callback: (err: Error, required?:boolean) => any) {
    var barrier = new File.EnsureBarrier("Compile.isRunRequired", 3);
    if(this.sharedData.headers)
      File.ensure(this.sharedData.headers, this.data.lastSuccessTime, {}, (err, required) => { barrier.dec(null, !!err || required) });
    else
      barrier.dec(null, true);
    File.ensure(this.inputFiles, this.data.lastSuccessTime, {}, barrier.decCallback());
    File.ensure(this.outputFiles, this.data.lastSuccessTime, {ensureDir: true}, barrier.decCallback());
    barrier.endWith(callback);
  }
}
Task.registerClass(CompileTask, "Compile");

export = CompileTask;