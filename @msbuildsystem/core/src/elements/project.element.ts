import {Element, Project} from '../index.priv';

export class ProjectElement extends Element {
  ___project: Project;

  constructor(project: Project, name: string) {
    super('project', name, null);
    this.___project = project;
  }

  __project() {
    return this.___project;
  }

  __absoluteFilepath() : string {
    return this.___project.directory;
  }
}
