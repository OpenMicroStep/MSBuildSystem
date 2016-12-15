import {Workspace, AttributePath, Target, getTargetClass, util, Diagnostic,
  TGraph, Task, Reporter, MakeJS,
  Element, ProjectElement, BuildTargetElement, TargetElement, EnvironmentElement
} from './index.priv';
import * as path from 'path';

export interface BuildGraphOptions {
  targets?: string[];
  environments?: string[];
  variants?: string[];
};

export function transformWithCategory(category: string) {
  return function setDiagCategory(diagnostic: Diagnostic) {
    diagnostic.category = category;
    return diagnostic;
  };
}

export class RootGraph extends TGraph<Target> {
  buildTargetElements: BuildTargetElement[] = [];
  constructor(public workspace: Workspace) {
    super({ name: "Root", type: "root", workspace: workspace.directory }, null!);
  }

  buildGraph(reporter: Reporter) {
    reporter.transform.push(transformWithCategory('graph'));
    this.iterate(false, (t: Target) => {
      t.buildGraph(reporter);
      return true;
    });
    reporter.transform.pop();
  }

  createTargets(reporter: Reporter, options: BuildGraphOptions, projects: Project[] = Array.from(this.workspace.projects.values())) {
    projects.forEach((project) => {
      let targets = project.targets;
      let environments = project.environments;
      let variants = options.variants || ["debug"];
      if (options.targets)
        targets = targets.filter(c => options.targets!.indexOf(c.name) !== -1);
      if (options.environments)
        environments = environments.filter(c => options.environments!.indexOf(c.name) !== -1);

      // Phase 1: create targets graph
      targets.forEach(target => {
        let targetEnvs = target.environments.filter(e => environments.indexOf(e) !== -1);
        targetEnvs.forEach(environment => {
          variants.forEach(variant => {
            this.createTarget(reporter, null, target, environment, variant);
          });
        });
      });
    });
  }

  createTarget(reporter: Reporter, requester: BuildTargetElement | null, target: TargetElement, environment: EnvironmentElement, variant: string) : Target | null {
    let task: Target | null = null;
    this.iterate(false, (t: Target) => {
      let e = t.attributes;
      if (e.__target === target && e.environment === environment && e.variant === variant)
        task = t;
      return !task;
    });
    if (!task && requester) {
      let buildTarget = this.buildTargetElements.find(e => {
        return e.__target === target && e.environment === environment && e.variant === variant;
      });
      if (buildTarget) {
        reporter.diagnostic({
          type: "error",
          msg: `cyclic dependencies between ${requester.__path()} and ${buildTarget.__path()}`,
          path: requester.__path()
        });
      }
      else {
        requester = null;
      }
    }
    if (!task && !requester) {
      reporter.transform.push(transformWithCategory('instantiate'));
      let buildTarget = new BuildTargetElement(reporter, this, target, environment, variant);
      let cls = getTargetClass(buildTarget.type);
      if (!cls) {
        reporter.diagnostic({
          type: "error",
          msg: `cannot create target ${buildTarget.__path()}, unsupported target type ${buildTarget.type}`,
          path: buildTarget.__path()
        });
      }
      else {
        task = new cls(this, buildTarget.__root().__project(), buildTarget);
      }
      reporter.transform.pop();
      if (task) {
        reporter.transform.push(transformWithCategory('configure'));
        task.configure(reporter, new AttributePath(task));
        reporter.transform.pop();
        reporter.transform.push(transformWithCategory('exports'));
        task.configureExports(reporter);
        reporter.transform.pop();
      }
    }
    return task;
  }

  id() {
    return "root";
  }

  storagePath(task: Task) {
    return null;
  }
}

export class Project {
  workspace: Workspace;
  directory: string;
  path: string;
  definition: MakeJS.Project | null;
  targets: TargetElement[];
  environments: EnvironmentElement[];
  tree: ProjectElement;
  reporter: Reporter;

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
      var Module = require('module');
      var m = new Module(this.path, null);
      m.load(this.path);
      this.definition = <MakeJS.Project>m.exports;
      this.definition.name = this.definition.name || "Unnamed project";
      this.loadDefinition(this.reporter);
    } catch (e) {
      this.reporter.error(e);
    }
  }

  loadDefinition(reporter: Reporter) {
    if (this.definition!.is !== 'project')
      reporter.diagnostic({ type: 'error', msg: `the root element 'is' attribute must be 'project'`});
    this.targets = [];
    this.environments = <EnvironmentElement[]>Array.from(Workspace.globalExports.values()).filter(e => e instanceof EnvironmentElement);
    this.tree = Element.load(reporter, this.definition!, new ProjectElement(this, this.definition!.name), {
      warningProbableMisuseOfKey: ["depth", "exports"],
      elementFactories: ["component", "group", "file", "target", "environment"]
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

export interface Run {
  name: string;
  path: string | { target: string };
  arguments: (string | { target: string })[];
}
