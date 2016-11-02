import {Workspace, AttributePath, Target, getTargetClass, util, Diagnostic,
  TGraph, Task, File, Reporter, MakeJS, Element,
  ProjectElement, BuildTargetElement, TargetElement, FileElement, EnvironmentElement
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

  doConfigure(reporter: Reporter) {
    this.iterate(false, (t: Target) => {
      t.doConfigure(reporter);
      reporter.diagnostics.forEach(d => {
        //if (!d.path) d.path = `${t.name.variant}/${t.name.environment}/${t.name.name}`;
      });
      return true;
    });
  }

  buildTargetElement(reporter: Reporter, target: TargetElement, environment: EnvironmentElement, variant: string) {
    let ret = this.buildTargetElements.find(e => {
      return e.__target === target && e.environment === environment && e.variant === variant;
    });
    if (!ret) {
      this.buildTargetElements.push(ret = new BuildTargetElement(reporter, this, target, environment, variant));
      ret.__resolveTargets(reporter);
    }
    return ret;
  }

  buildTarget(reporter: Reporter, buildTarget: BuildTargetElement, outputdir: string) : Target | null {
    let task: Target | null = null;
    this.iterate(false, (t: Target) => {
      if (t.attributes === buildTarget)
        task = t;
      return !task;
    });
    if (!task) {
      let cls = getTargetClass(buildTarget.type);
      if (!cls) {
        reporter.diagnostic({
          type: "error",
          msg: `cannot create target ${buildTarget.__path()}, unsupported target type ${buildTarget.type}`,
          path: buildTarget.__path()
        });
        return null;
      }
      task = new cls(this, buildTarget.__project(), buildTarget, {
        outputBasePath: outputdir,
        buildPath: path.join(outputdir, '.build'),
      });
      task.attributes.targets.forEach((dependency) => {
        var t = this.buildTarget(reporter, dependency, outputdir);
        if (t && (t === task || t.allDependencies().has(task!))) {
          reporter.diagnostic({
            type: "error",
            msg: `cyclic dependencies between ${t.attributes.__path()} and ${task!.attributes.__path()}`,
            path: buildTarget.__path()
          });
        }
        else if (t) {
          task!.addDependency(t);
        }
      });
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
  public workspace: Workspace;
  public directory: string;
  public path: string;
  public definition: MakeJS.Project | null;
  public targets: TargetElement[];
  public environments: EnvironmentElement[];
  protected tree: ProjectElement;
  public reporter: Reporter;

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

    reporter.transform.push(transformWithCategory('graph'));
    targets.forEach(target => {
      let targetEnvs = target.environments.filter(e => environments.indexOf(e) !== -1);
      targetEnvs.forEach(environment => {
        variants.forEach(variant => {
          let outputdirpath = outputdir
            .replace(/\$\{environment\}/g, environment.name)
            .replace(/\$\{variant\}/g, variant);
          root.buildTarget(reporter, root.buildTargetElement(reporter, target, environment, variant), outputdirpath);
        });
      });
    });
    reporter.transform.pop();

    reporter.transform.push(transformWithCategory('configure'));
    root.doConfigure(reporter);
    reporter.transform.pop();
    return root;
  }

  resolveElements(reporter: Reporter, query: string) : Element[] {
    return this.tree.resolveElements(reporter, query);
  }

  resolveFiles(reporter: Reporter, query: string) : File[] {
    var ret = <File[]>[];
    for (let el of this.tree.resolveElements(reporter, query)) {
      if (el.is === 'file')
        ret.push((<FileElement>el).__file);
    }
    return ret;
  }
}

export interface Run {
  name: string;
  path: string | { target: string };
  arguments: (string | { target: string })[];
}
