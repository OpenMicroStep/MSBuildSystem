import { Loader, Workspace, Reporter, util, Runner, Async } from '@msbuildsystem/core';
import { printDiagnostic, printReport } from './common';
import { args } from './args';

const cwd = process.cwd();
if (args.workspace)
  args.workspace = util.pathJoinIfRelative(cwd, args.workspace);
args.projects = args.projects ? args.projects.map(p => util.pathJoinIfRelative(cwd, p)) : [util.pathJoinIfRelative(cwd, "")];
if (args.command === "run" && args.action)
  args.command = args.action;
console.info("Arguments", args);
Loader.loadModules();
console.info("Modules:", Array.from(Loader.modules.values()).map(m => m.name).join(', '));
let workspace = new Workspace(args.workspace || undefined);
let projects = args.projects.map(p => workspace.project(p));
console.info(`Workspace: ${workspace.directory}`);
console.info(`Projects: ${projects.map(p => p.path).join(', ')}`);
let results = true;
projects.forEach(p => {
  var r = printReport(p.reporter, 'Project');
  results = results && r;
});
if (results) {
  let reporter = new Reporter();
  let graph = workspace.buildGraph(reporter, {
    environments: args.environments || undefined,
    variants: args.variants || undefined,
    targets: args.targets || undefined
  });
  if (printReport(reporter, 'Build graph')) {
    let runner = new Runner(graph, args.command, { ide: args.ide });
    runner.on("taskbegin", (context) => {
      console.info("BEGIN  ", context.task.graph && context.task.target().__path(), context.task.name);
    });
    runner.on("taskend", (context) => {
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
    Async.run(null, [
      Async.bind(runner, runner.run),
      (p) => {
        process.exit(p.context.failed ? 1 : 0);
      }
    ]);
  }
}
