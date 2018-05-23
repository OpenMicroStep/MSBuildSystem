let boot_t0 = process.hrtime();
import { util } from '@openmicrostep/msbuildsystem.core';
import { args } from './args';
import { npm } from './modules';
import { handle_run } from './run';
import * as chalk from 'chalk';

let boot_t1 = process.hrtime(boot_t0);
console.info("Boot time: ", (() => {
    var ns = boot_t1[0] * 1e9 + boot_t1[1];
    var ms = (ns / 1e6);
    return util.Formatter.duration.millisecond.short(ms);
})());

const cwd = process.cwd();
if (args.workspace)
  args.workspace = util.pathJoinIfRelative(cwd, args.workspace);
args.projects = args.projects ? args.projects.map(p => util.pathJoinIfRelative(cwd, p)) : [util.pathJoinIfRelative(cwd, "")];
if (args.command === "run" && args.action)
  args.command = args.action;

if (args.color === true)
  (chalk as any).enabled = true;

if (args.command === "modules") {
  npm(<any>args.action, args.modules);
}
else {
  handle_run();
}
