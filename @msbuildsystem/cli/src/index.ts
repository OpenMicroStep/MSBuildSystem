import { Loader, Workspace, Reporter, util, Runner, Async } from '@msbuildsystem/core';
import { printDiagnostic, printReport } from './common';
import { args } from './args';
import { npm } from './modules';
import * as chalk from 'chalk';

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
  Loader.loadModules();
  console.info("Modules:", Array.from(Loader.modules.values()).map(m => m.name).join(', '));
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
      let perf = util.performanceCounter("short");
      Async.run(null, [
        Async.bind(runner, runner.run),
        (p) => {
          printReport(reporter, 'Build', 'run', perf());
          process.exit(p.context.failed ? 1 : 0);
        }
      ]);
    }
  }
}
