import {Reporter, Diagnostic} from './index';

/** Very fast path management (push, pop) */
export type AttributePathComponent = ({ __path() : string } | string | number);
export class PathReporter {
  /** components of the path that are concatenated by toString() */
  private components: AttributePathComponent[];
  readonly reporter: Reporter;

  constructor(reporter: Reporter, ...components: AttributePathComponent[])
  constructor(reporter: Reporter) {
    this.components = [];
    this.reporter = reporter;
    var length = arguments.length;
    for (var i = 1; i < length; i++)
      this.components.push(arguments[i]);
  }

  reset(...components: AttributePathComponent[]) : this;
  reset() {
    var length = arguments.length;
    this.components = [];
    for (var i = 0; i < length; i++)
      this.components.push(arguments[i]);
    return this;
  }

  push(...components: AttributePathComponent[]) : this;
  push() {
    var length = arguments.length;
    for (var i = 0; i < length; i++)
      this.components.push(arguments[i]);
    return this;
  }

  pop(nb: number = 1) : this {
    while (--nb >= 0)
      this.components.pop();
    return this;
  }

  rewrite(...components: AttributePathComponent[]) : this
  rewrite() {
    var i = 0, len = arguments.length;
    var end = this.components.length - len;
    while (i < len)
      this.components[end++] = arguments[i++];
    return this;
  }

  set(attr: AttributePathComponent, at: number = -1) : this {
    this.components[at < 0 ? this.components.length + at : at] = attr;
    return this;
  }

  pushArray() : this {
    this.push('[', '', ']');
    return this;
  }
  setArrayKey(index: number | string) : this {
    this.set(index, -2);
    return this;
  }
  popArray() : this {
    this.pop(3);
    return this;
  }

  copy() {
    var cpy = new PathReporter(this.reporter);
    cpy.components = this.components.slice(0);
    return cpy;
  }

  toString() : string {
    return this.components.map(c => typeof c === "object" ? c.__path() : c).join('');
  }

  toJSON() {
    return this.toString();
  }

  diagnostic(d: Diagnostic, ...components: AttributePathComponent[]) {
    this.push(...components);
    if (this.components.length)
      d.path = this.toString() + (d.path || "");
    this.pop(components.length);
    this.reporter.diagnostic(d);
  }
}
