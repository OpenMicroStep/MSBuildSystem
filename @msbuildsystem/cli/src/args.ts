import * as argparse from 'argparse';
import ArgumentParser = argparse.ArgumentParser;
import ArgumentGroup = argparse.ArgumentGroup;
let Action: { new(options): Function } = (argparse as any).Action;

class ActionNoYes extends Action {
  dest: string;
  constant: boolean;

  constructor(options: any = {}) {
    options.nargs = 0;
    super(options);
  }
  call(parser, namespace, values, optionString: string) {
    namespace.set(this.dest, !optionString.startsWith('--no-'));
  }
}

const pkg = require('./package.json');
let parser = new ArgumentParser({
  prog: "msbuildsystem",
  version: pkg.version,
  addHelp: true
});

function addCommonArguments(parser: ArgumentGroup) {
  (parser as any).register('action', 'noYes', ActionNoYes);
  parser.addArgument(['--color'  ], { dest: "color", help: "Force colors to be enabled", action: "storeTrue" });
  parser.addArgument(['--debug'  ], { dest: "debug", help: "Debug output", action: "storeTrue" });
  parser.addArgument(['--full'   ], { dest: "full" , help: "Perform complete non incremental build", action: "storeTrue" });
  parser.addArgument(['--no-progress', '--progress'], { dest: "progress" , help: "Force desactivation/activation of the progressbar", action: "noYes" });
  parser.addArgument(['-p', '--project'  ], { dest: "projects", action: "append", help: "Path to the make.js file or directory, by default this is the current directory" });
  parser.addArgument(['-w', '--workspace'], { help: "Path to the workspace directory (ie. builddirectory)" });
  parser.addArgument(['--env'    ], { dest: "environments", action: "append", help: "Name of environments to consider, by default all environments are used" });
  parser.addArgument(['--target' ], { dest: "targets"     , action: "append", help: "Name of targets to consider, by default all targets are used" });
  parser.addArgument(['-j', '--jobs'], { dest: "jobs"    , type: "int", help: "Number of maximum concurrent jobs" });
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
  help: "Tool to target for generation"
});

let modules = subs.addParser('modules', { help: "manage buildystem modules", addHelp: true });
modules.addArgument(['action'], { choices: ['install', 'remove'] , help: "Modules to add or remove" });
modules.addArgument(['modules'], { help: "Modules to add or remove", metavar: 'MODULE', nargs: '+' });
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
  jobs?: number;
  workspace: string | null;
  projects: string[];
  targets: string[] | null;
  environments: string[] | null;
  color: boolean;
  debug: boolean;
  progress: boolean | null;
  full: boolean;
  modules: string[];
} = parser.parseArgs();
