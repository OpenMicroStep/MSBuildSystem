import {Workspace, Project, Target, AttributePath, getTargetClass, transformWithCategory,
  TGraph, Task, Reporter, BuildGraphOptions,
  BuildTargetElement, TargetElement, EnvironmentElement
} from './index.priv';

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
        if (task.attributes.targets.length) {
          let p = new AttributePath(task, '.targets[', '', ']');
          task.attributes.targets.forEach((targetName, i) => {
            p.set(i , -1);
            let depTargetElements = <TargetElement[]>this.workspace.resolveExports(targetName, buildTarget.environment.name, buildTarget.variant)
              .filter(t => t instanceof TargetElement);
            if (depTargetElements.length === 0) {
              p.diagnostic(reporter, {
                type: "error",
                msg: `the target '${targetName}' is not present in the workspace`
              });
            }
            else if (depTargetElements.length > 1) {
              p.diagnostic(reporter, {
                type: "error",
                msg: `the target '${targetName}' is present multiple times in the workspace, this shouldn't happen`
              });
            }
            else {
              let depTargetElement = depTargetElements[0];
              let compatibleEnv = depTargetElement.__compatibleEnvironment(reporter, environment);
              if (compatibleEnv) {
                let depTarget = this.createTarget(reporter, buildTarget, depTargetElement, compatibleEnv, buildTarget.variant);
                if (depTarget) {
                  task!.addDependency(depTarget);
                }
              }
            }
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
        reporter.transform.pop();
      }
    }
    return task;
  }

  id() {
    return null;
  }
}
