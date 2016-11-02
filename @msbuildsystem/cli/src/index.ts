import { ArgumentParser, ArgumentGroup } from 'argparse';
import * as chalk from 'chalk';
import { Loader, Workspace, Reporter, Diagnostic, util, Runner, Async, RootGraph } from '@msbuildsystem/core';
let parser = new ArgumentParser({
  prog: "msbuildsystem",
  version: '0.0.1',
  addHelp: true
});

function addCommonArguments(parser: ArgumentGroup) {
  parser.addArgument(['-p', '--project'], { help: "Path to the make.js file or directory, by default this is the current directory" });
  parser.addArgument(['-w', '--workspace'], { help: "Path to the workspace directory (ie. builddirectory)" });
  parser.addArgument(['--env']    , { dest: "environments", action: "append", help: "Name of environments to consider, by default all environments are used" });
  parser.addArgument(['--variant'], { dest: "variants"    , action: "append", help: "Name of variants to consider, by default the 'debug' variant is used" });
  parser.addArgument(['--target'] , { dest: "targets"     , action: "append", help: "Name of targets to consider, by default all targets are used" });
}

let subs = parser.addSubparsers({
  title: "Subcommands",
  dest: "command"
});
let generate = subs.addParser('generate', {
  help: "generate IDE related files (autocompletion, project definition, etc...)",
  addHelp: true
});
addCommonArguments(generate);
generate.addArgument(['ide'], {
  choices: ["xcode", "vscode", "sublimetext"]
});

let make = subs.addParser('build', { help: "run the build action", addHelp: true });
addCommonArguments(make);
let clean = subs.addParser('clean', { help: "run the clean action", addHelp: true });
addCommonArguments(clean);
let execute = subs.addParser('execute', { help: "run the execute action", addHelp: true });
addCommonArguments(execute);
let run = subs.addParser('run', { help: "run any action", addHelp: true });
run.addArgument(['action'], { help: "Action to run (build, clean, ...)" });
addCommonArguments(run);

let args: {
  command: string,
  action: string | null,
  workspace: string | null,
  project: string | null,
  targets: string[] | null;
  environments: string[] | null;
  variants: string[] | null;
} = parser.parseArgs();
Loader.loadModules();


let colors = {
  "note": chalk.cyan,
  "remark": chalk.cyan,
  "warning": chalk.magenta,
  "error": chalk.red,
  "fatal error": chalk.red
};
function stats(diagnostics: Diagnostic[]) {
  if (diagnostics.length === 0)
    return '';
  let types = ["note", "remark", "warning", "error", "fatal error"];
  let stats = diagnostics.reduce((prev, current) => {
    prev[current.type] = (prev[current.type] || 0) + 1;
    return prev;
  }, {});
  return ' (' + types
    .map(t => stats[t] ? `${stats[t]} ${colors[t](t + (stats[t] > 1 ? 's' : ''))}` : '')
    .filter(t => !!t)
    .join(', ') + ')';
}
function printDiagnostic(d: Diagnostic) : string {
  let ret = "";
  if (d.path) {
    ret += d.path;
    if (d.row) {
      ret += ':' + d.row;
      if (d.col)
        ret += ':' + d.col;
    }
    ret += " ";
  }
  ret += colors[d.type](d.type) + ': ' + d.msg;
  return ret;
}
function printReport(reporter: Reporter, prefix: string, action = "load") {
  if (reporter.diagnostics.length) {
    console.info('');
    console.info(reporter.diagnostics.map(printDiagnostic).join('\n'));
    console.info('');
    if (reporter.failed)
      console.info(`${prefix} failed to ${action}: ${reporter.diagnostics.length} issues${stats(reporter.diagnostics)}`);
    else
      console.info(`${prefix} ${action}: ${reporter.diagnostics.length} issues${stats(reporter.diagnostics)}`);
  }
  else {
    console.info(`${prefix} ${action} without issues`);
  }
  return !reporter.failed;
}

args.workspace = util.pathJoinIfRelative(process.cwd(), args.workspace || "bootstrap/");
args.project = util.pathJoinIfRelative(process.cwd(), args.project || "");
console.info(args);
let workspace = new Workspace(args.workspace);
let project = workspace.project(args.project);
console.info(`Workspace: ${args.workspace}`);
console.info(`Project: ${args.project}`);
if (printReport(project.reporter, 'Project')) {
  let reporter = new Reporter();
  let graph = project.buildGraph(reporter, {
    environments: args.environments || undefined,
    variants: args.variants || undefined,
    targets: args.targets || undefined
  });
  if (printReport(reporter, 'Build graph')) {
    let runner = new Runner(graph, 'build');
    runner.on("taskbegin", (context) => {
      if (!(context.task instanceof RootGraph))
        console.info("BEGIN ", context.task.target().__path(), context.task.name);
    });
    runner.on("taskend", (context) => {
      if (!(context.task instanceof RootGraph))
        console.info("END   ", context.task.target().__path(), context.task.name);
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
