/// <reference path="../../typings/tsd.d.ts" />
'use strict';

import ProcessTask = require('../tasks/_Process');
import Target = require('./../core/Target');
import CXXTarget = require('./_CXXTarget');
import path = require('path');

class CXXExternal extends CXXTarget {
  commands: {bin:string, args:string[], env: {[s: string]: string}}[] = [];
  addCommand(bin: string, args: string[], env: {[s: string]: string})
  {
    this.commands.push({
      bin:path.isAbsolute(bin) ? bin : path.join(this.workspace.directory, bin),
      args:args,
      env:env
    });
  }
  buildGraph(callback: ErrCallback) {
    var last = null;
    var i = 0;
    this.commands.forEach((command) => {
      var cmd = new ProcessTask("Command #" + (++i).toString(), this);
      cmd.bin = command.bin;
      cmd.addFlags(command.args);
      cmd.setEnv(command.env);
      this.applyTaskModifiers(cmd);
      if(last) {
        cmd.addDependency(last)
      }
      last = cmd;
    });
    callback();
  }
}
Target.registerClass(CXXExternal, "CXXExternal");

export = CXXExternal;
