import {Element} from '../element';
import {Project} from '../project';

export class ProjectElement extends Element {
  ___project: Project;

  constructor(project: Project) {
    super('project', null, null);
    this.___project = project;
  }

  __project() {
    return this.___project;
  }
}