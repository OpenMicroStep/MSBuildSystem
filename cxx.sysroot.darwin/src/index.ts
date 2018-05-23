import {LocalProcessProvider, ProcessProviders} from '@openmicrostep/msbuildsystem.foundation';
import * as child_process from 'child_process';

if (ProcessProviders.isOutOfDate) {
  if (process.platform === "darwin") {
    try { // autodetect clang
      let ret = child_process.execSync('clang --version').toString('utf8');
      let m = ret.match(/Apple LLVM version ([\d\.]+) \(clang-[\d\.]+\)/);
      if (m) {
        ProcessProviders.register(new LocalProcessProvider("clang", { type: "compiler", compiler: "clang", version: "apple/" + m[1] }));
        ProcessProviders.register(new LocalProcessProvider("clang", { type: "linker", linker: "clang", version: "apple/" + m[1] }));
      }
    } catch (e) {}
    try { // autodetect clang
      let ret = child_process.execSync('libtool -V').toString('utf8');
      let m = ret.match(/Apple Inc. version cctools-([\d\.]+)/);
      if (m)
        ProcessProviders.register(new LocalProcessProvider("libtool", { type: "linker", linker: "libtool", version: "apple/" + m[1] }));
    } catch (e) {}
  }
}
