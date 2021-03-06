import {Workspace, Project, Target, PathReporter,
  Graph, Reporter, BuildGraphOptions, Diagnostic,
  Element, BuildTargetElement, TargetElement, EnvironmentElement, TargetExportsElement
} from '../index.priv';
import * as fs from 'fs-extra';
import * as path from 'path';
const transformWithCategory = Reporter.transformWithCategory;

export class RootGraph extends Graph {
  buildTargetElements: BuildTargetElement[] = [];
  exports: TargetExportsElement[] = [];
  constructor(public workspace: Workspace) {
    super({ name: "Root", type: "root", workspace: workspace.directory }, null!);
  }

  buildGraph(reporter: Reporter) {
    reporter.transform.push(transformWithCategory('graph'));
    for (let t of this.iterator(false) as IterableIterator<Target>) {
      t.buildGraph(reporter);
      if (t.preTasks) {
        for (let input of t.inputs) {
          if (input !== t.preTasks)
            input.addDependency(t.preTasks);
        }
      }
      if (t.postsTasks) {
        for (let output of t.outputs) {
          if (output !== t.postsTasks)
            t.postsTasks.addDependency(output);
        }
      }
    }
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
          this.createTarget(reporter, undefined, target, environment, !!options.allowManual);
        }
      }
    }
    if (selected === 0) {
      reporter.diagnostic({
        is: "error",
        msg: "no target selected",
        notes: this.workspace.targets().map<Diagnostic>(t => ({
          is: "note", msg: `possible target: '${t.name}'`,
          notes: t.environments.map<Diagnostic>(e => ({is: "note", msg: `possible environment: '${e.name}'`}))
        }))
      });
    }
  }

  createTarget(reporter: Reporter, requester: BuildTargetElement | undefined, target: TargetElement, environment: EnvironmentElement, allowManual: boolean) : Target | undefined {
    let task: Target | undefined = undefined;
    for (let t of this.iterator(false) as IterableIterator<Target>) {
      let e = t.attributes;
      if (e.__target === target && e.environment === environment) {
        task = t;
        break;
      }
    }
    if (!task && requester) {
      let buildTarget = this.buildTargetElements.find(e => e.__target === target && e.environment === environment);
      if (buildTarget) {
        reporter.diagnostic({
          is: "error",
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
      let defs = path.join(this.workspace.pathToBuild(environment.name), "defs");
      fs.ensureDirSync(defs);
      fs.writeFileSync(path.join(defs, `${target.name}.json`), JSON.stringify(buildTarget, null, 2));
      if (!buildTarget.manual || allowManual)
        task = this._createTarget(reporter, buildTarget);
    }
    return task;
  }

  private _createTarget(reporter: Reporter, buildTarget: BuildTargetElement) : Target | undefined {
    let task: Target | undefined;
    let cls = Target.providers.validate.validate(new PathReporter(reporter, buildTarget), buildTarget.type);
    if (cls) {
      task = new cls(this, buildTarget.__root().__project(), buildTarget);
      if (task.attributes.targets.length) {
        let at = new PathReporter(reporter, task, '.targets[', '', ']');
        task.attributes.targets.forEach((targetName, i) => {
          at.set(i , -2);
          let depTarget = this.findTarget(at, buildTarget, targetName, buildTarget.environment);
          if (depTarget)
            task!.addDependency(depTarget);
        });
      }
    }
    reporter.transform.pop();
    if (task) {
      reporter.transform.push(transformWithCategory('configure'));
      task.configure(new PathReporter(reporter, task));
      reporter.transform.pop();
      reporter.transform.push(transformWithCategory('exports'));
      task.configureExports(reporter);
      this.loadExportsDefinition(reporter, task.exports);
      reporter.transform.pop();
    }
    return task;
  }

  findTargetElement(at: PathReporter, name: string) : TargetElement | undefined {
    let depTargetElements = this.workspace.targets().filter(t => t.name === name);
    if (depTargetElements.length === 0) {
      at.diagnostic({
        is: "error",
        msg: `the target '${name}' is not present in the workspace`
      });
    }
    else if (depTargetElements.length > 1) {
      at.diagnostic({
        is: "error",
        msg: `the target '${name}' is present multiple times in the workspace, this shouldn't happen`
      });
    }
    return depTargetElements[0];
  }

  findTarget(at: PathReporter, requester: BuildTargetElement, name: string, environment: {name: string, compatibleEnvironments: string[]}): Target | undefined {
    let depTargetElement = this.findTargetElement(at, name);
    if (depTargetElement) {
      let compatibleEnv = depTargetElement.__compatibleEnvironment(at.reporter, environment);
      if (compatibleEnv)
        return this.createTarget(at.reporter, requester, depTargetElement, compatibleEnv, true);
    }
    return undefined;
  }

  resolveExports(at: PathReporter, requester: BuildTargetElement, steps: string[]) : TargetExportsElement[] {
    let name = steps[0];
    let env = steps[1] ? { name: steps[1], compatibleEnvironments: [] as string[] } : requester.environment;
    let filter = (e: TargetExportsElement) =>
      (e.name === name) &&
      (e.environment === env.name || env.compatibleEnvironments.indexOf(e.environment) !== -1);
    let ret = this.exports.filter(filter);
    if (ret.length === 0) {
      if (this.findTarget(at, requester, name, env) ||
          this.loadShared(at, requester, name, env))
        ret = this.exports.filter(filter);
    }
    return ret;
  }

  loadShared(at: PathReporter, requester: BuildTargetElement, name: string, environment: {name: string, compatibleEnvironments: string[]}) : TargetExportsElement | undefined {
    let envs = [environment.name, ...environment.compatibleEnvironments];
    for (let env of envs) {
      let filename = this.workspace.pathToSharedExports(env, name);
      try  {
        return this.loadExportsDefinition(at.reporter, JSON.parse(fs.readFileSync(filename, 'utf8')));
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
