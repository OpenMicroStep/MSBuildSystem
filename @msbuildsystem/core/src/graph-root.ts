import {Workspace, Project, Target, AttributePath, getTargetClass, transformWithCategory,
  Graph, Reporter, BuildGraphOptions,
  Element, BuildTargetElement, TargetElement, EnvironmentElement, TargetExportsElement
} from './index.priv';
import * as fs from 'fs';

export class RootGraph extends Graph {
  buildTargetElements: BuildTargetElement[] = [];
  exports: TargetExportsElement[] = [];
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
    let selected = 0;
    for (let project of projects) {
      let targets = project.targets;
      if (options.targets)
        targets = targets.filter(c => options.targets!.indexOf(c.name) !== -1);

      // Phase 1: create targets graph
      for (let target of targets) {
        let targetEnvs = target.environments.filter(e => !options.environments || options.environments.indexOf(e.name) !== -1);
        for (let environment of targetEnvs) {
          selected++;
          this.createTarget(reporter, undefined, target, environment);
        }
      }
    }
    if (selected === 0) {
      reporter.diagnostic({
        type: "error",
        msg: "no target selected"
      });
    }
  }

  createTarget(reporter: Reporter, requester: BuildTargetElement | undefined, target: TargetElement, environment: EnvironmentElement) : Target | undefined {
    let task: Target | undefined = undefined;
    this.iterate(false, (t: Target) => {
      let e = t.attributes;
      if (e.__target === target && e.environment === environment)
        task = t;
      return !task;
    });
    if (!task && requester) {
      let buildTarget = this.buildTargetElements.find(e => e.__target === target && e.environment === environment);
      if (buildTarget) {
        reporter.diagnostic({
          type: "error",
          msg: `cyclic dependencies between ${requester.__path()} and ${buildTarget.__path()}`,
          path: requester.__path()
        });
      }
      else {
        requester = undefined;
      }
    }
    if (!task && !requester) {
      reporter.transform.push(transformWithCategory('instantiate'));
      let buildTarget = new BuildTargetElement(reporter, this, target, environment);
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
        if (task.attributes.targets.length) {
          let p = new AttributePath(task, '.targets[', '', ']');
          task.attributes.targets.forEach((targetName, i) => {
            p.set(i , -2);
            let depTarget = this.findTarget(reporter, p, buildTarget, targetName, buildTarget.environment);
            if (depTarget)
              task!.addDependency(depTarget);
          });
        }
      }
      reporter.transform.pop();
      if (task) {
        reporter.transform.push(transformWithCategory('configure'));
        task.configure(reporter, new AttributePath(task));
        reporter.transform.pop();
        reporter.transform.push(transformWithCategory('exports'));
        task.configureExports(reporter);
        this.loadExportsDefinition(reporter, task.exports.__serialize(reporter));
        reporter.transform.pop();
      }
    }
    return task;
  }

  findTargetElement(reporter: Reporter, at: AttributePath, name: string) : TargetElement | undefined {
    let depTargetElements = this.workspace.targets().filter(t => t.name === name);
    if (depTargetElements.length === 0) {
      at.diagnostic(reporter, {
        type: "error",
        msg: `the target '${name}' is not present in the workspace`
      });
    }
    else if (depTargetElements.length > 1) {
      at.diagnostic(reporter, {
        type: "error",
        msg: `the target '${name}' is present multiple times in the workspace, this shouldn't happen`
      });
    }
    return depTargetElements[0];
  }

  findTarget(reporter: Reporter, at: AttributePath, requester: BuildTargetElement, name: string, environment: {name: string, compatibleEnvironments: string[]}): Target | undefined {
    let depTargetElement = this.findTargetElement(reporter, at, name);
    if (depTargetElement) {
      let compatibleEnv = depTargetElement.__compatibleEnvironment(reporter, environment);
      if (compatibleEnv)
        return this.createTarget(reporter, requester, depTargetElement, compatibleEnv);
    }
    return undefined;
  }

  resolveExports(reporter: Reporter, at: AttributePath, requester: BuildTargetElement, steps: string[]) : TargetExportsElement[] {
    let name = steps[0];
    let env = steps[1] ? { name: steps[1], compatibleEnvironments: [] as string[] } : requester.environment;
    let filter = (e: TargetExportsElement) =>
      (e.name === name) &&
      (e.environment === env.name || env.compatibleEnvironments.indexOf(e.environment) !== -1);
    let ret = this.exports.filter(filter);
    if (ret.length === 0) {
      if (this.findTarget(reporter, at, requester, name, env) ||
          this.loadShared(reporter, at, requester, name, env))
        ret = this.exports.filter(filter);
    }
    return ret;
  }

  loadShared(reporter: Reporter, at: AttributePath, requester: BuildTargetElement, name: string, environment: {name: string, compatibleEnvironments: string[]}) : TargetExportsElement | undefined {
    let envs = [environment.name, ...environment.compatibleEnvironments];
    for (let env of envs) {
      let filename = this.workspace.pathToSharedExports(env, name);
      try  {
        return this.loadExportsDefinition(reporter, JSON.parse(fs.readFileSync(filename, 'utf8')));
      } catch (e) {}
    }
    return undefined;
  }

  loadExportsDefinition(reporter: Reporter, definition) {
    let el = new TargetExportsElement('component', definition.name, definition.environment);
    Element.load(reporter, definition, el, Project.elementExportsFactories);
    this.exports.push(el);
    return el;
  }

  id() {
    return null;
  }
}
