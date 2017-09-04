import { Loader, Workspace, Reporter, util, Runner, RunnerContext, Async, Task, AttributePath, TaskDoMapReduce, Graph, Node } from '@openmicrostep/msbuildsystem.core';
import { ReporterPrinter, Report } from './common';
import { args } from './args';
import { stallDetector, throttle } from './stall';
import * as readline from 'readline';
import * as tty from 'tty';

export function handle_run() {
  let perf_load = util.performanceCounter("short");
  Loader.loadModules();
  console.info("Modules [%s] loaded in %s", Array.from(Loader.modules.values()).map(m => m.name).join(', '), perf_load());
  let perf = util.performanceCounter();
  let printer = new ReporterPrinter();
  let workspace = new Workspace(args.workspace || undefined);
  let projects = args.projects.map(p => {
    let perf = util.performanceCounter();
    let project = workspace.project(p);
    printer.push(new Report(`Project ${p}`, project.reporter, perf()));
    return project;
  });
  workspace.fixDirectoryPendingResolution();
  printer.push(new Report(`Workspace ${workspace.directory}`, workspace.reporter));
  if (printer.report.failed)
    return end();

  workspace.save();
  let reporter = new Reporter();
  let perf_grap = util.performanceCounter();
  let graph = workspace.buildGraph(reporter, {
    environments: args.environments || undefined,
    targets: args.targets || ([] as string[]).concat(...projects.map(p => p.targets.map(t => t.name))),
    allowManual: !!args.targets
  });
  printer.push(new Report('Build graph generation', reporter, perf_grap()));
  if (printer.report.failed)
    return end();

  let options: any = {};
  if (typeof args.jobs === "number")
    options.maxConcurrentTasks = args.jobs;
  if (typeof args.ide === "string")
    options.ide = args.ide;
  if (typeof args.full === "boolean")
    options.full = args.full;
  let runner = new Runner(graph, args.command, options);
  if (args.debug) {
    function where(task: Node) {
      return [...task.parents().reverse().slice(1), task].map(p => p.toString()).join(" - ");
    }
    runner.on("taskbegin", (context) => {
      if (context.task instanceof Graph) return;
      console.info("BEGIN  ", where(context.task));
    });
    runner.on("taskend", (context) => {
      if (context.task instanceof Graph) return;
      let wasrun = !!(context as any).actionRequired;
      if (context.reporter.diagnostics.length) {
        console.info("DIAGS ∨");
        console.info(context.reporter.diagnostics.map(d => printer.formatDiagnostic(d)).join('\n'));
        console.info("LOGS  ∨");
        console.info(context.reporter.logs);
        console.info(`END ${wasrun ? "X" : "O"} ∧`, where(context.task), (context.lastRunEndTime - context.lastRunStartTime) + 'ms');
      }
      else {
        console.info(`END ${wasrun ? "X" : "O"}  `, where(context.task), (context.lastRunEndTime - context.lastRunStartTime) + 'ms');
      }
    });
  }
  runner.on("taskend", (context) => {
    if (!(context.task instanceof Graph))
      printer.push(new Report(
        `Target ${context.task.graph && context.task.target().__path()}, task ${context.task}`,
        context.reporter,
        context.lastRunEndTime - context.lastRunStartTime
      ));
  });
  if (!args.debug && args.progress !== false && (args.progress === true || (process.stderr.isTTY && (process.stderr as tty.WriteStream).columns > 30))) {
    let stderr = process.stderr as tty.WriteStream;
    let tasks = new Set<Node>();
    let nblines = 0;
    let count = 0;
    let run = 0;
    let done = 0;
    let stalls = stallDetector(100);
    let averageTaskLoad = 0;
    let averageTaskTime0 = util.now();
    let averageTaskTimei = util.now();

    function updateAverageTaskLoad(load_was: number) {
      let now = util.now();
      let d0_i = averageTaskTimei - averageTaskTime0;
      let di_n = now - averageTaskTimei;
      averageTaskLoad = (averageTaskLoad * d0_i + load_was * di_n) / (d0_i + di_n);
      averageTaskTimei = now;
    }
    for (let task of runner.iterator(true))
      if (!(task instanceof Graph))
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

    let progressbarDirect = () => {
      let progress1 = `   ${Math.floor(done * 100 / count)}`.slice(-3);
      let progress2 = `(${run}/${done}/${count})`;
      let width = Math.max(0, stderr.columns -  21 - progress2.length);
      let partdone = Math.floor(done * width / count);
      let stallsTxt = stalls.stalls.length === 0 ? 'none' : stalls.stalls.map(dt => util.Formatter.duration.millisecond.short(dt)).join(', ');
      writelines([
        `Progression: [${"-".repeat(partdone)}${" ".repeat(width - partdone)}] ${progress1}% ${progress2}`,
        `Elapsed: ${util.Formatter.duration.millisecond.short(perf())}, ` +
        `Load: ${averageTaskLoad.toFixed(2)}, ` +
        `Issues: ${printer.formatStats() || "none"}`,
        tasks.size > 0 ? `Active tasks (${tasks.size}): ${Array.from(tasks.values()).map(t => `${t.target()} > ${t}`).join(" & ")}` : `Done`,
        `Stalls: ${stallsTxt}`,
      ]);
    };
    let progressbar = throttle(250, progressbarDirect);
    let interval = setInterval(progressbar, 250);
    runner.on("taskbegin", (context) => {
      if (!(context.task instanceof Graph)) {
        updateAverageTaskLoad(tasks.size);
        tasks.add(context.task);
        progressbar();
      }
    });
    runner.on("taskend", (context) => {
      if (!(context.task instanceof Graph)) {
        if ((context as any).actionRequired !== false)
          ++run;
        ++done;
        updateAverageTaskLoad(tasks.size);
        tasks.delete(context.task);
        progressbar();
      }
      if (context.task === graph) {
        progressbarDirect();
        stalls.stop();
        clearInterval(interval);
      }
    });
  }
  let provider: TaskDoMapReduce<any, any> | undefined = undefined;
  if (args.command === "generate") {
    let reporter = new Reporter();
    provider = Task.generators.validate.validate(reporter, new AttributePath('ide'), args.ide);
    printer.push(new Report(`Generator validation`, reporter));
  }
  if (printer.report.failed)
    return end();
  Async.run<RunnerContext>(null, [
    f => provider ? runner.runWithMapReduce(f, provider) : runner.run(f),
    f => {
      end();
      f.continue();
    }
  ]);

  function end() {
    console.log(printer.formatReports('Build', perf()));
    process.exit(printer.report.stats['error'] + printer.report.stats['fatal error']);
  }
}
