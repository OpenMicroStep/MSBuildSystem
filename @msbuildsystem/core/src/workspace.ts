import {Project, Reporter, BuildGraphOptions, RootGraph, Element, AttributeTypes, AttributePath, util, Directory, ElementFactory} from './index.priv';
import * as path from 'path';
import * as fs from 'fs';

function requiredAbsolutePath(directory: string) {
  directory = path.normalize(directory);
  if (!path.isAbsolute(directory))
    throw "'directory' must be absolute (directory=" + directory + ")";
  return directory;
}

interface WorkspaceData {
  projects: Directory[];
}

const workspaceDataValidator = AttributeTypes.objectValidator<WorkspaceData, Workspace>([{
  path: "projects", validator: AttributeTypes.validateDirectory, default: []
}]);

export class Workspace {
  static globalRoot = new Element('root', 'global', null);
  static globalExports = new Map<string, Element>();
  projects = new Map<string, Project>();
  path: string;
  reporter: Reporter;

  constructor(public directory: string = '/opt/microstep') {
    directory = requiredAbsolutePath(directory);
    this.reporter = new Reporter();
    this.path = path.join(directory, 'workspace.json');
    try {
      let data = JSON.parse(fs.readFileSync(this.path, 'utf8'));
      let validatedData = workspaceDataValidator(this.reporter, new AttributePath(this.path), data, this);
      validatedData.projects.forEach(d => this.project(d.path));
    } catch (e) {}
  }

  project(directory: string) : Project {
    directory = requiredAbsolutePath(directory);
    let project = this.projects.get(directory);
    if (!project)
      this.projects.set(directory, project = new Project(this, directory));
    return project;
  }

  removeProject(directory) {
    directory = requiredAbsolutePath(directory);
    this.projects.delete(directory);
  }

  save() {
    let data = { projects: Array.from(this.projects.keys()).map(d => util.pathRelativeToBase(this.directory, d)) };
    fs.writeFileSync(this.path, JSON.stringify(data, null, 2), 'utf8');
  }

  buildGraph(reporter: Reporter, options: BuildGraphOptions) : RootGraph {
    let root = new RootGraph(this);
    root.createTargets(reporter, options);
    if (!reporter.failed)
      root.buildGraph(reporter);
    return root;
  }

  resolveExports(name: string, environmentName: string, variantName: string) : Element[] {
    let sources = <Element[]>[];
    if (Workspace.globalExports.has(name))
      sources.push(Workspace.globalExports.get(name)!);
    this.projects.forEach((p) => sources.push(...p.targets.filter(t => t.name === name)));
    // TODO: resolve exports in .shared
    return sources;
  }
}
