import {Parser} from './index';

export type Query = {
  groups: string[][],
  requiredTags: string[], rejectedTags: string[],
  explicitAttributes?: Set<string>, removedAttributes?: Set<string>,
  method?: string,
};

export function parseQuery(parser: Parser) : Query {
  let ret: Query = {
    groups: [],
    requiredTags: [],
    rejectedTags: [],
    explicitAttributes: undefined,
    removedAttributes: undefined,
    method: undefined
  };
  if (!parser.consume('='))
    return ret;

  parser.skip(Parser.isAnySpaceChar);
  let level = parser.test('{');
  parser.skip(Parser.isAnySpaceChar);
  if (parser.ch !== '?') {
    parseGroups(parser, ret);
    parser.skip(Parser.isAnySpaceChar);
  }
  if (parser.test('?')) {
    parseTags(parser, ret);
    parser.skip(Parser.isAnySpaceChar);
  }
  if (level && parser.consume('}')) {
    parser.skip(Parser.isAnySpaceChar);
    if (parser.test('.'))
      ret.method = parser.while(Parser.isWordChar, 1);
    else
      parseAttributes(parser, ret);
    parser.skip(Parser.isAnySpaceChar);
  }
  if (!parser.atEnd() && !parser.reporter.failed)
    parser.error(`query is not fully parsed`);
  return ret;
}

function parseGroups(parser: Parser, ret: Query) {
  do {
    ret.groups.push(parser.while(isNotQueryGroupSpecialChar, 1).split(':').map(g => g.trim()));
  } while (parser.test('+'));
}
function parseTags(parser: Parser, ret: Query) {
  do {
    parser.skip(Parser.isAnySpaceChar);
    if (parser.test('!')) {
      parser.skip(Parser.isAnySpaceChar);
      ret.rejectedTags.push(parser.while(isNotQueryTagSpecialChar, 1).trim());
    }
    else {
      ret.requiredTags.push(parser.while(isNotQueryTagSpecialChar, 1).trim());
    }
  } while (parser.test('+'));
}
function parseAttributes(parser: Parser, ret: Query) {
  function parseAttrs(prefix: string, list: Set<string>) {
    while (parser.test(prefix)) {
      parser.skip(Parser.isAnySpaceChar);
      list.add(parser.while(isNotQueryAttrSpecialChar, 1).trim());
    }
  }
  if (parser.ch === '+')
    parseAttrs('+', ret.explicitAttributes = new Set());
  else if (parser.ch === '-')
    parseAttrs('-', ret.removedAttributes = new Set());
  else
    parser.error(`explicit or exclusion attributes list expected`);
}
function isNotQueryGroupSpecialChar(ch: string) {
  return "+?{}!".indexOf(ch) === -1;
}
function isNotQueryTagSpecialChar(ch: string) {
  return "=+?{}!:".indexOf(ch) === -1;
}
function isNotQueryAttrSpecialChar(ch: string) {
  return "=+-?{}!:".indexOf(ch) === -1;
}
