import { Loader, Workspace, Reporter, util, Runner, Async } from '@msbuildsystem/core';
import { printDiagnostic, printReport } from './common';
import { args } from './args';

Loader.loadModules();

args.workspace = util.pathJoinIfRelative(process.cwd(), args.workspace || "bootstrap/");
args.project = util.pathJoinIfRelative(process.cwd(), args.project || "");
if (args.command === "run" && args.action)
  args.command = args.action;
console.info("Arguments", args);
let workspace = new Workspace(args.workspace);
let project = workspace.project(args.project);
console.info(`Workspace: ${workspace.directory}`);
console.info(`Project: ${project.path}`);
if (printReport(project.reporter, 'Project')) {
  let reporter = new Reporter();
  let graph = project.buildGraph(reporter, {
    environments: args.environments || undefined,
    variants: args.variants || undefined,
    targets: args.targets || undefined
  });
  if (printReport(reporter, 'Build graph')) {
    let runner = new Runner(graph, args.command, { ide: args.ide });
    runner.on("taskbegin", (context) => {
      console.info("BEGIN ", context.task.graph && context.task.target().__path(), context.task.name);
    });
    runner.on("taskend", (context) => {
      console.info("END   ", context.task.graph && context.task.target().__path(), context.task.name, (context.lastRunEndTime - context.lastRunStartTime) + 'ms');
      if (context.reporter.diagnostics.length)
        console.info(context.reporter.diagnostics.map(printDiagnostic).join('\n'));
    });
    Async.run(null, [
      Async.bind(runner, runner.run),
      (p) => {
        process.exit(p.context.failed ? 1 : 0);
      }
    ]);
  }
}
