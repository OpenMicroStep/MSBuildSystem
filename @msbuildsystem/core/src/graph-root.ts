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
    projects.forEach((project) => {
      let targets = project.targets;
      let variants = options.variants || ["debug"];
      if (options.targets)
        targets = targets.filter(c => options.targets!.indexOf(c.name) !== -1);

      if (targets.length === 0) {
        reporter.diagnostic({
          type: "error",
          msg: "no target where selected"
        });
      }

      // Phase 1: create targets graph
      targets.forEach(target => {
        let targetEnvs = target.environments.filter(e => !options.environments || options.environments.indexOf(e.name) !== -1);
        targetEnvs.forEach(environment => {
          variants.forEach(variant => {
            this.createTarget(reporter, undefined, target, environment, variant);
          });
        });
      });
    });
  }

  createTarget(reporter: Reporter, requester: BuildTargetElement | undefined, target: TargetElement, environment: EnvironmentElement, variant: string) : Target | undefined {
    let task: Target | undefined = undefined;
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
        requester = undefined;
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
        if (task.attributes.targets.length) {
          let p = new AttributePath(task, '.targets[', '', ']');
          task.attributes.targets.forEach((targetName, i) => {
            p.set(i , -2);
            let depTarget = this.findTarget(reporter, p, buildTarget, targetName, buildTarget.environment, buildTarget.variant);
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

  findTarget(reporter: Reporter, at: AttributePath, requester: BuildTargetElement, name: string, environment: {name: string, compatibleEnvironments: string[]}, variant: string): Target | undefined {
    let depTargetElement = this.findTargetElement(reporter, at, name);
    if (depTargetElement) {
      let compatibleEnv = depTargetElement.__compatibleEnvironment(reporter, environment);
      if (compatibleEnv)
        return this.createTarget(reporter, requester, depTargetElement, compatibleEnv, variant);
    }
    return undefined;
  }

  resolveExports(reporter: Reporter, at: AttributePath, requester: BuildTargetElement, steps: string[]) : TargetExportsElement[] {
    let name = steps[0];
    let env = steps[1] ? { name: steps[1], compatibleEnvironments: [] as string[] } : requester.environment;
    let variant = steps[2] || requester.variant;
    let filter = (e: TargetExportsElement) =>
      (e.name === name) &&
      (e.environment === env.name || env.compatibleEnvironments.indexOf(e.environment) !== -1) &&
      (e.variant === variant);
    let ret = this.exports.filter(filter);
    if (ret.length === 0) {
      if (this.findTarget(reporter, at, requester, name, env, variant || requester.variant) ||
          this.loadShared(reporter, at, requester, name, env, variant || requester.variant))
        ret = this.exports.filter(filter);
    }
    return ret;
  }

  loadShared(reporter: Reporter, at: AttributePath, requester: BuildTargetElement, name: string, environment: {name: string, compatibleEnvironments: string[]}, variant: string) : TargetExportsElement | undefined {
    let envs = [environment.name, ...environment.compatibleEnvironments];
    for (let env of envs) {
      let filename = this.workspace.pathToSharedExports(env, variant, name);
      try  {
        return this.loadExportsDefinition(reporter, JSON.parse(fs.readFileSync(filename, 'utf8')));
      } catch (e) {}
    }
    return undefined;
  }

  loadExportsDefinition(reporter: Reporter, definition) {
    let el = new TargetExportsElement('component', definition.name, definition.environment, definition.variant);
    Element.load(reporter, definition, el, Project.elementExportsFactories);
    this.exports.push(el);
    return el;
  }

  id() {
    return null;
  }
}
