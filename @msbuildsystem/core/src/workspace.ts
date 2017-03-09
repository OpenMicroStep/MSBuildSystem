import {Project, Reporter, BuildGraphOptions, RootGraph, Element, AttributeTypes, AttributePath, util, Directory, File, TargetElement} from './index.priv';
import * as path from 'path';
import * as fs from 'fs';
import * as fs_extra from 'fs-extra';
import * as os from 'os';

function requiredAbsolutePath(directory: string) {
  directory = path.normalize(directory.replace(/(\/|\\)+$/, ''));
  if (!path.isAbsolute(directory))
    throw "'directory' must be absolute (directory=" + directory + ")";
  return directory;
}

interface WorkspaceData {
  projects: Directory[];
}

const workspaceDataValidator = AttributeTypes.objectValidator<WorkspaceData, Workspace>({
  projects: { validator: AttributeTypes.listValidator(File.validateDirectory), default: [] }
});

export class Workspace {
  static globalRoot = new Element('root', 'global', null);
  static globalExports = new Map<string, Element>();
  directory: string;
  projects = new Map<string, Project>();
  path: string;
  reporter: Reporter;

  static createTemporary() : Workspace {
    let f = fs.mkdtempSync(path.join(os.tmpdir() , 'msworkspace-'));
    let w = new Workspace(f);
    process.on('exit', () => w.clear());
    return w;
  }

  static pendingResolutionDirectory = '/7a151994-fab1-4390-859c-bf7bd9aa65f4';
  constructor(directory: string = Workspace.pendingResolutionDirectory) {
    this.directory = requiredAbsolutePath(directory);
    this.reporter = new Reporter();
    this.path = path.join(this.directory, 'workspace.json');
    if (!this.isDirectoryPendingResolution()) {
      try {
        let data = JSON.parse(fs.readFileSync(this.path, 'utf8'));
        let validatedData = workspaceDataValidator(this.reporter, new AttributePath(this.path), data, this);
        validatedData.projects.forEach(d => this.project(d.path));
      } catch (e) {}
    }
  }

  isDirectoryPendingResolution() {
    return this.directory === Workspace.pendingResolutionDirectory;
  }

  fixDirectoryPendingResolution(directory: string) {
    if (this.isDirectoryPendingResolution()) {
      this.directory = `/opt/microstep/${directory}`;
      this.path = path.join(this.directory, 'workspace.json');
    }
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
    if (this.isDirectoryPendingResolution())
      throw new Error(`cannot save: workspace directory isn't defined`);
    let data = { projects: Array.from(this.projects.keys()).map(d => util.pathRelativeToBase(this.directory, d)) };
    fs.writeFileSync(this.path, JSON.stringify(data, null, 2), 'utf8');
  }

  clear() {
    if (this.isDirectoryPendingResolution())
      throw new Error(`cannot clear: workspace directory isn't defined`);
    this.projects = new Map<string, Project>();
    try {
      fs_extra.removeSync(this.directory);
    } catch (e) {
      // TODO: Log a warning to the logger ?
    }
  }

  buildGraph(reporter: Reporter, options: BuildGraphOptions) : RootGraph {
    if (this.isDirectoryPendingResolution())
      throw new Error(`cannot buildGraph: workspace directory isn't defined`);
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

  targets() : TargetElement[] {
    let r = <TargetElement[]>[];
    this.projects.forEach(p => r.push(...p.targets));
    return r;
  }
}
