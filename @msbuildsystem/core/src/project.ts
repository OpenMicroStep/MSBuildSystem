import {Workspace, util, RootGraph, Reporter, MakeJS,
  createElementFactoriesProviderMap, AttributePath, ProviderMap,
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
  definition: MakeJS.Project | null;
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
    this.definition = null;
    try {
      const makejs = fs.readFileSync(this.path, 'utf8');
      const sandbox = {
        __filename: this.path,
        __dirname: path.dirname(this.path),
        require: function(module) {
          if (allowedModules.has(module))
            return require(module);
          throw new Error(`module ${module} is not one of: ${[...allowedModules].join(', ')}`);
        },
        module: { exports: {} },
        Value: Element.asValue,
      };
      vm.createContext(sandbox);
      vm.runInContext(makejs, sandbox, { filename: this.path, displayErrors: true });
      this.definition = <MakeJS.Project>sandbox.module.exports;
      this.definition.name = this.definition.name || "Unnamed project";
      if (this.directory === this.workspace.directory)
        this.reporter.diagnostic({ type: "warning", msg: "it's highly recommended to not use the project folder as workspace folder" });
      this.loadDefinition(this.reporter);
    } catch (e) {
      this.reporter.error(e);
    }
  }

  loadDefinition(reporter: Reporter) {
    if (this.definition!.is !== 'project')
      reporter.diagnostic({ type: 'error', msg: `the root element 'is' attribute must be 'project'`});
    this.targets = [];
    this.tree = Element.load(reporter, this.definition!, new ProjectElement(this, this.definition!.name), Project.elementFactories);
    let allTargets = this.workspace.targets();
    this.targets.forEach(target => {
      if (target.environments.length === 0) {
        reporter.diagnostic({
          type: "error",
          msg: "environments list is empty",
          path: `${target.__path()}.environments`
        });
      }
      if (allTargets.indexOf(target) !== allTargets.lastIndexOf(target)) {
        reporter.diagnostic({
          type: "error",
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
