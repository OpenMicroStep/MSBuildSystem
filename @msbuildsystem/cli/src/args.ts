import { ArgumentParser, ArgumentGroup } from 'argparse';

let parser = new ArgumentParser({
  prog: "msbuildsystem",
  version: '0.0.1',
  addHelp: true
});

function addCommonArguments(parser: ArgumentGroup) {
  parser.addArgument(['-p', '--project'  ], { dest: "projects", action: "append", help: "Path to the make.js file or directory, by default this is the current directory" });
  parser.addArgument(['-w', '--workspace'], { help: "Path to the workspace directory (ie. builddirectory)" });
  parser.addArgument(['--env'    ], { dest: "environments", action: "append", help: "Name of environments to consider, by default all environments are used" });
  parser.addArgument(['--variant'], { dest: "variants"    , action: "append", help: "Name of variants to consider, by default the 'debug' variant is used" });
  parser.addArgument(['--target' ], { dest: "targets"     , action: "append", help: "Name of targets to consider, by default all targets are used" });
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
  help: "Tool to target for generation",
  choices: ["terminal", "xcode", "vscode", "sublimetext"],
  defaultValue: "terminal"
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

export const args: {
  command: string;
  action?: string;
  ide?: string;
  workspace: string | null;
  projects: string[] | null;
  targets: string[] | null;
  environments: string[] | null;
  variants: string[] | null;
} = parser.parseArgs();
