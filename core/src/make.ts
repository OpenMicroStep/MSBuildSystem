export type ElementPath = string;

export interface Element {
  is: string;
  name?: any;
  [s: string]: any;
}

export interface Component extends Element {
  name: string;
  components?: (ElementPath | Component)[];
  tags?: string[];
}

export interface Project extends Element {
  is: 'project';
  name: string;
}

export interface Group extends Element {
  is: 'group';
  name: string;
  path?: string;
  elements: (ElementPath | Element)[];
}

export interface File {
  is: 'file';
  name: string | RegExp | ((relativepath: string) => boolean);
  depth?: number;
  [s: string]: any;
}

export interface Environment extends Component {
  is: 'environment';
  compatibleEnvironments?: string[];
}

export interface Target extends Component {
  is: 'target';
  type: string;
  files: ElementPath[];
  filesByEnvironment: {[s: string]: ElementPath[]};
  componentsByEnvironment: {[s: string]: (ElementPath | Component)[]};
}

export interface Run extends Component {
  is: 'run';
}
