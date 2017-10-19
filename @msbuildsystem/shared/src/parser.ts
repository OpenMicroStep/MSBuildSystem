import {Reporter} from './index';

export class Parser {
  ch: string = ""; // current character
  aheadchars: string[] = [];
  at: number = 0; // index of the current character
  line: number = 0; // current line
  atline: number = 0; // index of the first character of the line
  reporter: Reporter;
  source: () => string; // read the next char from source

  constructor(reporter: Reporter, source: (() => string) | string) {
    this.reporter = reporter;
    if (typeof source === 'string') {
      let pos = -1;
      this.source = () => source[++pos] || '';
    }
    else {
      this.source = source;
    }
    this.ch = this.source() ;
  }
  static isNotNumberChar(ch: string) { return !Parser.isNumberChar(ch); }
  static isNumberChar(ch: string) {
    return '0' <= ch && ch <= '9';
  }
  static isNotWordChar(ch: string) { return !Parser.isWordChar(ch); }
  static isWordChar(ch: string) {
    return ch === '_' ||
      ('A' <= ch && ch <= 'Z') ||
      ('a' <= ch && ch <= 'z') ||
      ('0' <= ch && ch <= '9');
  }
  static isNotSpaceChar(ch: string) { return !Parser.isSpaceChar(ch); }
  static isSpaceChar(ch: string) {
    return ch === ' ' || ch === '\t';
  }
  static isNotLineChar(ch: string) { return !Parser.isLineChar(ch); }
  static isLineChar(ch: string) {
    return ch === '\n';
  }
  static isNotAnySpaceChar(ch: string) { return !Parser.isAnySpaceChar(ch); }
  static isAnySpaceChar(ch: string) {
    return ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r';
  }

  atEnd() : boolean {
    return !this.ch;
  }

  ahead(amount: number) : string {
    let ret = this.ch;
    if (ret) {
      amount--;
      let ch: string;
      let i = this.aheadchars.length;
      while (i > 0 && amount-- > 0)
        ret += (ch = this.aheadchars[--i]);
      while (amount-- > 0 && (ch = this.source())) {
        this.aheadchars.unshift(ch);
        ret += ch;
      }
    }
    return ret;
  }

  next() : string {
    if (Parser.isLineChar(this.ch)) {
      this.line++;
      this.atline = this.at + 1;
    }
    this.ch = this.aheadchars.length ? this.aheadchars.pop()! : this.source();
    if (this.ch)
      this.at++;
    return this.ch;
  }

  error(message: string) {
    this.reporter.diagnostic({
      is: "error",
      msg: message,
      row: this.line + 1,
      col: this.at - this.atline + 1
    });
  }

  test<T extends string>(expected: T, consume = true) : T | "" {
    let actual = expected.length === 1 ? this.ch : this.ahead(expected.length);
    let same = actual === expected;
    if (same && consume)
      for (let i = 0; i < expected.length; i++)
        this.next();
    return same ? expected : "";
  }

  consume<T extends string>(expected: T) : T {
    let pos = 0;
    while (pos < expected.length && this.ch === expected[pos]) {
      pos++;
      this.next();
    }
    if (pos !== expected.length)
      this.error(`expecting: ${expected}, received: ${expected.substring(0, pos)}${this.ch}`);
    return expected;
  }

  while(predicate: (ch: string) => boolean, minLength: number) : string {
    let ret = "";
    while (this.ch && predicate(this.ch)) {
      ret += this.ch;
      this.next();
    }
    if (ret.length < minLength)
      this.error(`expecting to match ${predicate.name} x (${ret.length}/${minLength}), received: ${this.ch}`);
    return ret;
  }

  skip(predicate: (ch: string) => boolean, minLength: number = 0) : number {
    let count = 0;
    while (this.ch && predicate(this.ch)) {
      this.next();
      count++;
    }
    if (count < minLength)
      this.error(`expecting to match ${predicate.name} x (${count}/${minLength}), received: ${this.ch}`);
    return count;
  }
}
