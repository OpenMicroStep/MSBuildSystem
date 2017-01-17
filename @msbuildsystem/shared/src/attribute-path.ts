import {Reporter, Diagnostic} from './index';

/** Very fast path management (push, pop) */
export type AttributePathComponent = ({ __path() : string } | string | number);
export class AttributePath {
  /** components of the path that are concatenated by toString() */
  components: AttributePathComponent[];

  constructor(...components: AttributePathComponent[]);
  constructor() {
    this.reset.apply(this, arguments);
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

  copy() {
    var cpy = new AttributePath();
    cpy.components = this.components.slice(0);
    return cpy;
  }

  toString() : string {
    return this.components.map(c => typeof c === "object" ? c.__path() : c).join('');
  }

  diagnostic(reporter: Reporter, d: Diagnostic, ...components: AttributePathComponent[]) {
    this.push(...components);
    d.path = this.toString() + (d.path || "");
    this.pop(components.length);
    reporter.diagnostic(d);
  }
}
