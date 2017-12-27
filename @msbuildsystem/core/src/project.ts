import {Workspace, util, RootGraph, Reporter, MakeJS,
  createElementFactoriesProviderMap, PathReporter, ProviderMap,
  Element, ElementDefinition, ProjectElement, TargetElement
} from './index.priv';
import * as path from 'path';
import * as vm from 'vm';
import * as fs from 'fs';

export interface BuildGraphOptions {
  targets?: string[];
  environments?: string[];
  allowManual?: boolean;
};

const allowedModules = new Set(["path", "fs", "child_process", "os"]);
export class Project {
  workspace: Workspace;
  directory: string;
  path: string;
  definition: MakeJS.Project;
  targets: TargetElement[];
  tree: ProjectElement;
  reporter: Reporter;

  static elementFactories = createElementFactoriesProviderMap('project');
  static elementExportsFactories = createElementFactoriesProviderMap('project exports');

  constructor(workspace: Workspace, directory: string, name = "make.js") {
    this.workspace = workspace;
    this.directory = directory;
    this.path = path.join(directory, name);
    this.reload();
  }

  reload() {
    this.reporter = new Reporter();
    let fix = true;
    try {
      const makejs = fs.readFileSync(this.path, 'utf8');
      try {
        const sandbox = {
          __filename: this.path,
          __dirname: path.dirname(this.path),
          require: function (module) {
            if (allowedModules.has(module))
              return require(module);
            throw new Error(`module ${module} is not one of: ${[...allowedModules].join(', ')}`);
          },
          module: { exports: {} },
          Value: Element.asValue,
        };
        vm.createContext(sandbox);
        vm.runInContext(makejs, sandbox, { filename: this.path, displayErrors: true });
        this.definition = sandbox.module.exports as any;
        if (typeof this.definition !== 'object') {
          this.reporter.diagnostic({ is: "error", msg: `make.js must exports a project element` });
          this.definition = { is: "project", name: this.directory };
        }
        if (this.directory === this.workspace.directory)
          this.reporter.diagnostic({ is: "warning", msg: "it's highly recommended to not use the project folder as workspace folder" });
        this.loadDefinition(this.reporter);
        fix = false;
      }
      catch (e) {
        this.reporter.error(e);
      }
    } catch (e) {
      this.reporter.diagnostic({ is: "error", msg: `project definition not found`, path: this.path });
    }
    if (fix) {
      this.definition = { is: "project", name: this.directory };
      this.targets = [];
      this.tree = new ProjectElement(this, this.definition.name);
    }
  }

  loadDefinition(reporter: Reporter) {
    if (this.definition!.is !== 'project')
      reporter.diagnostic({ is: "error", msg: `the root element 'is' attribute must be 'project'`});
    if (!this.definition.name) {
      reporter.diagnostic({ is: "error", msg: `the root element 'name' attribute must be defined` });
      this.definition.name = this.directory;
    }
    this.targets = [];
    this.tree = Element.load(reporter, this.definition!, new ProjectElement(this, this.definition!.name), Project.elementFactories);
    let allTargets = this.workspace.targets();
    this.targets.forEach(target => {
      if (target.environments.length === 0) {
        reporter.diagnostic({
          is: "error",
          msg: "environments list is empty",
          path: `${target.__path()}.environments`
        });
      }
      if (allTargets.indexOf(target) !== allTargets.lastIndexOf(target)) {
        reporter.diagnostic({
          is: "error",
          msg: `the target '${target}' is present multiple times in the workspace, this shouldn't happen`,
          path: `${target.__path()}`
        });
      }
    });
  }

  resolveFilePath(filepath: string) {
    return util.pathJoinIfRelative(this.directory, filepath);
  }

  buildGraph(reporter: Reporter, options: BuildGraphOptions) : RootGraph {
    let root = new RootGraph(this.workspace);
    root.createTargets(reporter, options, [this]);
    if (!reporter.failed)
      root.buildGraph(reporter);
    return root;
  }
}
["components", "elements", "depth"].forEach(n => Project.elementFactories.warningProbableMisuseOfKey.add(n));

export interface Run {
  name: string;
  path: string | { target: string };
  arguments: (string | { target: string })[];
}
