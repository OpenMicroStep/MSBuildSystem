import {Project} from './Project';
import {Reporter} from './runner';
import {TargetElement} from './elements/target.element';
import * as MakeJS from './make';
import * as path from 'path';

export class Workspace {
  projects = new Map<string, Project>();

  project(directory:string) : Project {
    directory = path.normalize(directory);
    if (!path.isAbsolute(directory))
      throw "'directory' must be absolute (directory=" + directory + ")";

    let project = this.projects.get(directory);
    if (!project)
      this.projects.set(directory, project = new Project(this, directory));
    return project;
  }

}
