import {Project, MakeJSElement} from '../index.priv';

export class ProjectElement extends MakeJSElement {
  ___project: Project;

  constructor(project: Project, name: string) {
    super('project', name, null);
    this.___project = project;
  }

  __absoluteFilepath() : string {
    return this.___project.directory;
  }

  __project() {
    return this.___project;
  }
}
