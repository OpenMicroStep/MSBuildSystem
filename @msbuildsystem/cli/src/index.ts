let boot_t0 = process.hrtime();
import { Loader, Workspace, Reporter, util, Runner, RunnerContext, Async, Task, AttributePath, TaskDoMapReduce, TGraph } from '@msbuildsystem/core';
import { printDiagnostic, printReport } from './common';
import { args } from './args';
import { npm } from './modules';
import * as chalk from 'chalk';
import * as readline from 'readline';
import * as tty from 'tty';

let boot_t1 = process.hrtime(boot_t0);
console.info("Boot time: ", (() => {
    var ns = boot_t1[0] * 1e9 + boot_t1[1];
    var ms = (ns / 1e6);
    return util.formatDuration(ms, { format: "short" });
})());


function stallDetector(limit: number) : { longest: number, last: number, mean(): number, stalls: number[], count: number, stop() : void } {
  let ret = {
    longest: 0,
    last: 0,
    mean() {
      return ret.count > 0 ? ret.sum / ret.count : 0;
    },
    sum: 0,
    count: 0,
    stalls: [] as number[],
    stop: stop
  };
  let t0 = util.now();
  let immediate = setImmediate(function tick() {
    let t = util.now();
    let dt = t - t0;
    ret.last = dt;
    if (dt > limit)
      ret.stalls.push(dt);
    ret.longest = Math.max(ret.longest, dt);
    ret.sum += dt;
    ret.count++;
    t0 = t;
    immediate = setImmediate(tick);
  });
  function stop() {
    clearImmediate(immediate);
  }
  return ret;
}

const cwd = process.cwd();
if (args.workspace)
  args.workspace = util.pathJoinIfRelative(cwd, args.workspace);
args.projects = args.projects ? args.projects.map(p => util.pathJoinIfRelative(cwd, p)) : [util.pathJoinIfRelative(cwd, "")];
if (args.command === "run" && args.action)
  args.command = args.action;
//console.info("Arguments", args);

(chalk as any).enabled = !!args.color;


if (args.command === "modules") {
  npm(<any>args.action, args.modules);
}
else {
  handle_run();
}

function handle_run() {
  let perf = util.performanceCounter("short");
  Loader.loadModules();
  console.info("Modules [%s] loaded in %s", Array.from(Loader.modules.values()).map(m => m.name).join(', '), perf());
  let workspace = new Workspace(args.workspace || undefined);
  let results = true;
  let projects = args.projects.map(p => {
    let perf = util.performanceCounter("short");
    let project = workspace.project(p);
    results = results && printReport(project.reporter, 'Project', 'load', perf());
    return project;
  });
  console.info(`Workspace: ${workspace.directory}`);
  console.info(`Projects: ${projects.map(p => p.path).join(', ')}`);
  workspace.save();
  if (results) {
    let reporter = new Reporter();
    let perf = util.performanceCounter("short");
    let graph = workspace.buildGraph(reporter, {
      environments: args.environments || undefined,
      variants: args.variants || undefined,
      targets: args.targets || undefined
    });
    if (printReport(reporter, 'Build graph', 'load', perf())) {
      let reporter = new Reporter();
      let runner = new Runner(graph, args.command, { ide: args.ide });
      let perf = util.performanceCounter("short");
      if (args.debug) {
        runner.on("taskbegin", (context) => {
          console.info("BEGIN  ", context.task.graph && context.task.target().__path(), context.task.name);
        });
        runner.on("taskend", (context) => {
          reporter.aggregate(context.reporter);
          if (context.reporter.diagnostics.length) {
            console.info("DIAGS ∨");
            console.info(context.reporter.diagnostics.map(printDiagnostic).join('\n'));
            console.info("LOGS  ∨");
            console.info(context.reporter.logs);
            console.info("END   ∧", context.task.graph && context.task.target().__path(), context.task.name, (context.lastRunEndTime - context.lastRunStartTime) + 'ms');
          }
          else {
            console.info("END    ", context.task.graph && context.task.target().__path(), context.task.name, (context.lastRunEndTime - context.lastRunStartTime) + 'ms');
          }
        });
      }
      else {
        runner.on("taskend", (context) => {
          reporter.aggregate(context.reporter);
        });
      }
      if (!args.debug && process.stderr.isTTY /* args.progressbar */) {
        let stderr = process.stderr as tty.WriteStream;
        let tasks = new Set<Task>();
        let nblines = 0;
        let count = 0;
        let done = 0;
        let stalls = stallDetector(100);
        for (let task of runner.iterator(true))
          if (!(task instanceof TGraph))
            ++count;
        function writelines(lines: string[]) {
          if (nblines > 0)
            readline.moveCursor(stderr, 0, -nblines);
          let i = 0;
          for (; i < lines.length; i++) {
            readline.clearLine(stderr, 0);
            stderr.write(`\r${lines[i].substring(0, stderr.columns)}\n`);
          }
          nblines = lines.length;
        }

        let progressbar = /*throttle(100, */(() => {
          let width = (stderr.columns -  20);
          let progress = `   ${Math.floor(done * 100 / count)}`.slice(-3);
          let partdone = Math.floor(done * width / count);
          writelines([
            `Progression: [${"-".repeat(partdone)}${" ".repeat(width - partdone)}] ${progress}%`,
            `Elapsed: ${perf()}, Stalls: ${stalls.stalls.length === 0 ? 'none' : stalls.stalls.map(dt => util.formatDuration(dt, { format: "short" })).join(', ')}`,
            tasks.size > 0 ? `Active tasks (${tasks.size}): ${Array.from(tasks.values()).map(t => `${t.target()} > ${t}`).join(" & ")}` : `Done`,
          ]);
        });
        runner.on("taskbegin", (context) => {
          if (!(context.task instanceof TGraph)) {
            tasks.add(context.task);
            progressbar();
          }
        });
        runner.on("taskend", (context) => {
          if (!(context.task instanceof TGraph)) {
            ++done;
            tasks.delete(context.task);
            progressbar();
          }
          if (context.task === graph) {
            progressbar/*.now*/();
            stalls.stop();
          }
        });
      }
      let provider: TaskDoMapReduce<any, any> | undefined = undefined;
      let ok = true;
      if (args.command === "generate") {
        let reporter = new Reporter();
        provider = Task.generators.validate(reporter, new AttributePath('ide'), args.ide);
        ok = !!(provider && printReport(reporter, 'Find generator', 'load'));
      }
      if (ok) {
        Async.run<RunnerContext>(null, [
          f => provider ? runner.runWithMapReduce(f, provider) : runner.run(f),
          (p) => {
            printReport(reporter, 'Build', 'run', perf());
            process.exit(p.context.failed ? 1 : 0);
          }
        ]);
      }
    }
  }
}
