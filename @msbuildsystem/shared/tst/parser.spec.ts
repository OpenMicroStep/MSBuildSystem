import {Parser, Reporter, Diagnostic} from '@openmicrostep/msbuildsystem.shared';
import {assert} from 'chai';


function state(parser: Parser) {
  return { ch: parser.ch, at: parser.at, line: parser.line, atline: parser.atline, atEnd: parser.atEnd() };
}
function assertState<T>(parser: Parser, result: T, expect: { r: T, ch: string, at: number, line: number, atline: number, atEnd: boolean }) {
  assert.deepEqual(Object.assign(state(parser), { r: result }), expect);
}

function empty(source: (() => string) | string) {
  let parser = new Parser(new Reporter(), source);
  assert.isTrue(parser.atEnd());
  assert.strictEqual(parser.ch, '');
  assert.strictEqual(parser.at, 0);
  assert.strictEqual(parser.line, 0);
  assert.strictEqual(parser.atline, 0);
}

function basics() {
  let parser = new Parser(new Reporter(), ' <div> \n Some HTML\t</div>');
  assertState(parser, parser.skip(Parser.isSpaceChar)   , { r: 1            , ch: '<' , at:  1, line: 0, atline: 0, atEnd: false });
  assertState(parser, parser.test('<')                  , { r: '<'          , ch: 'd' , at:  2, line: 0, atline: 0, atEnd: false });
  assertState(parser, parser.test('<')                  , { r: ''           , ch: 'd' , at:  2, line: 0, atline: 0, atEnd: false });
  assertState(parser, parser.while(Parser.isWordChar, 0), { r: 'div'        , ch: '>' , at:  5, line: 0, atline: 0, atEnd: false });
  assertState(parser, parser.test('<')                  , { r: ''           , ch: '>' , at:  5, line: 0, atline: 0, atEnd: false });
  assertState(parser, parser.consume('>')               , { r: '>'          , ch: ' ' , at:  6, line: 0, atline: 0, atEnd: false });
  assertState(parser, parser.test('>')                  , { r: ''           , ch: ' ' , at:  6, line: 0, atline: 0, atEnd: false });
  assertState(parser, parser.skip(Parser.isSpaceChar)   , { r: 1            , ch: '\n', at:  7, line: 0, atline: 0, atEnd: false });
  assertState(parser, parser.skip(Parser.isAnySpaceChar), { r: 2            , ch: 'S' , at:  9, line: 1, atline: 8, atEnd: false });
  assertState(parser, parser.while(ch => ch !== '<', 0) , { r: 'Some HTML\t', ch: '<' , at: 19, line: 1, atline: 8, atEnd: false });
  assertState(parser, parser.test('</div<')             , { r: ''           , ch: '<' , at: 19, line: 1, atline: 8, atEnd: false });
  assertState(parser, parser.test('</div>', false)      , { r: '</div>'     , ch: '<' , at: 19, line: 1, atline: 8, atEnd: false });
  assert.deepEqual(parser.reporter.diagnostics, []);
  assertState(parser, parser.consume('</div<')          , { r: '</div<'     , ch: '>' , at: 24, line: 1, atline: 8, atEnd: false });
  assert.deepEqual<Diagnostic[]>(parser.reporter.diagnostics, [{ type: "error", msg: "expecting: </div<, received: </div>", col: 17, row: 2 }]);
}

function perfs_native(n: number) {
  let source = () => ' ';
  for (let i = 0; i < n; i++)
    source();
}

function perfs_next(n: number) {
  let parser = new Parser(new Reporter(), () => ' ');
  for (let i = 0; i < n; i++)
    parser.next();
}

function perfs_while(n: number) {
  let parser = new Parser(new Reporter(), () => ' ');
  let i = n;
  while (i > 0) {
    let chunk = 100;
    i -= parser.while(ch => chunk-- > 0, 100).length;
  }
}

function perfs_skip(n: number) {
  let parser = new Parser(new Reporter(), () => ' ');
  let i = 0;
  parser.skip(ch => i++ < n);
}

export const tests = { name: "parser", tests: [
  basics,
  function empty_source() { empty(() => ''); },
  function empty_string() { empty(''); },
  { name: 'perfs', tests: [
    { name: 'native 10M', test: () => perfs_native(100 * 1e6) },
    { name: 'next 5M', test: () => perfs_next(5 * 1e6) },
    { name: 'skip 5M', test: () => perfs_skip(5 * 1e6) },
    { name: 'while 2M', test: () => perfs_while(2 * 1e6) },
  ]},
]};
