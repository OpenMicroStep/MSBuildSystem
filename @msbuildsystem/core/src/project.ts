import {Workspace, AttributePath, Target, getTargetClass, util, Diagnostic,
  TGraph, Task, Reporter, MakeJS,
  ProjectElement, BuildTargetElement, TargetElement, EnvironmentElement
} from './index.priv';
import * as path from 'path';

export interface BuildGraphOptions {
  targets?: string[];
  environments?: string[];
  variants?: string[];
  outputdir?: string;
};

function transformWithCategory(category: string) {
  return function setDiagCategory(diagnostic: Diagnostic) {
    diagnostic.category = category;
    return diagnostic;
  };
}

export class RootGraph extends TGraph<Target> {
  buildTargetElements: BuildTargetElement[] = [];
  constructor() {
    super({ name: "Root", type: "root" }, null!);
  }

  buildGraph(reporter: Reporter) {
    this.iterate(false, (t: Target) => {
      t.buildGraph(reporter);
      return true;
    });
  }

  buildTarget(reporter: Reporter, requester: BuildTargetElement | null, target: TargetElement, environment: EnvironmentElement, variant: string, outputdir: string) : Target | null {
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
      let buildTarget = new BuildTargetElement(reporter, this, target, environment, variant, outputdir);
      let cls = getTargetClass(buildTarget.type);
      if (!cls) {
        reporter.diagnostic({
          type: "error",
          msg: `cannot create target ${buildTarget.__path()}, unsupported target type ${buildTarget.type}`,
          path: buildTarget.__path()
        });
      }
      else {
        task = new cls(this, buildTarget.__project(), buildTarget);
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
    this.environments = [];
    this.tree = new ProjectElement(this, this.definition!.name);
    reporter.transform.push(transformWithCategory('load'));
    this.tree.__load(reporter, this.definition!, new AttributePath(this.tree));
    reporter.transform.pop();
    reporter.transform.push(transformWithCategory('resolve'));
    this.tree.__resolve(reporter);
    reporter.transform.pop();
  }

  resolveFilePath(filepath: string) {
    return util.pathJoinIfRelative(this.directory, filepath);
  }

  buildGraph(reporter: Reporter, options: BuildGraphOptions) : RootGraph {
    let targets = this.targets;
    let environments = this.environments;
    let variants = options.variants || ["debug"];
    let outputdir = options.outputdir || path.join(this.workspace.directory, "${environment}/${variant}");
    let root = new RootGraph();
    if (options.targets)
      targets = targets.filter(c => options.targets!.indexOf(c.name) !== -1);
    if (options.environments)
      environments = environments.filter(c => options.environments!.indexOf(c.name) !== -1);

    // Phase 1: create targets graph
    targets.forEach(target => {
      let targetEnvs = target.environments.filter(e => environments.indexOf(e) !== -1);
      targetEnvs.forEach(environment => {
        variants.forEach(variant => {
          let outputdirpath = outputdir
            .replace(/\$\{environment\}/g, environment.name)
            .replace(/\$\{variant\}/g, variant);
          root.buildTarget(reporter, null, target, environment, variant, outputdirpath);
        });
      });
    });

    // Phase 2: create sub graph for each target
    if (!reporter.failed) {
      reporter.transform.push(transformWithCategory('graph'));
      root.buildGraph(reporter);
      reporter.transform.pop();
    }
    return root;
  }
}

export interface Run {
  name: string;
  path: string | { target: string };
  arguments: (string | { target: string })[];
}
