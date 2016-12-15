/* parse d'une interface
in:                                   out:
## class Person : Object              {
Description de la classe              Person=: {
                                        is:class,
                                        superclass: Object
### attributes                          attributes: [=_version, ..., =_birthDate],
#### _version:   integer                _version=:   {is: attribute, type:integer},
#### _firstName: string                 _firstName=: {is: attribute, type:string},
#### _lastName:  string                 _lastName=:  {is: attribute, type:string},
#### _birthDate: date                   _birthDate=: {is: attribute, type:date}
                                        categories: [=core, =calculation],
                                        core=: {
### category core [ts, objc]              is:category, langages:  [ts,objc],
                                          methods: [=firstName, ..., =birthDate],
#### firstName() : string                 firstName=: {is:method, type:{arguments:[],return:string}},
#### lastName()  : string                 lastName=:  {is:method, type:{arguments:[],return:string}},
#### fullName()  : string                 fullName=:  {is:method, type:{arguments:[],return:string}},
#### birthDate() : date                   birthDate=: {is:method, type:{arguments:[],return:date}},
                                          },
### farCategory calculation [objc]      calculation=: {
#### age()       : integer                is:farCategory, langages:  [objc],
                                          methods: [=age,=tst],
                                          age=: {is:method, type:{arguments:[],return:string}},
#### tst(x:date ,y:{a:int}): {r:[1,*,{r:int}]};
                                          tst=:{is:method,type:{arguments:[date,{a:int}],return:{r:[1,*,{r:int}]}}}
                                          }
                                        aspects= [=server, =client],
### aspect server                       server=: {
#### categories: core, calculation        is:aspect,
                                          categories: [=core, =calculation]
                                          }
### aspect client                       client=: {
#### categories: core                     is:aspect,
#### farCategories: calculation           categories: [=core],
                                          farCategories: [=calculation]
                                          }
                                        }
                                      AnotherClass=: {...}
                                      }
*/
import * as fs from 'fs';
import {Flux} from '@msbuildsystem/core';

// response in pool.context.response or pool.context.error
export function interfaceParseFileCont(pool: Flux<{ error?: string, response: any }>, path: string) {
  fs.readFile(path, 'utf8', function (err, data) {
    if (err) {
      pool.context.error = "interfaceParseFileCont error: " + err;
      pool.continue();
    }
    else interfaceParseCont(pool, data);
  });
}

export function interfaceParseCont(pool: Flux<{ error?: string, response: any }>, data: string) {
  var x = interfaceParse(data);
  if (x.is === 'error') pool.context.error = x;
  else pool.context.response = x;
  pool.continue();
}

// retourne la source md traduite en JSON.
// Si erreur, retourne {is:error, errors:[{line,index,err}], result:r}
export function interfaceParse(source: string) {
  var text: string,
    ch: string | undefined,     // The current character ch = text[at-1]
    at: number, lg: number,  // The index of the next character and the lg of the text
    line: number,   // le numéro de la ligne
    atline: number, // l'index du premier caractère de la ligne
    errors: { line: number, index: number, error: string }[]
    ;
  function _error(m: string) {
    errors.push({ line: line, index: at - atline, error: m });
  }
  // Get the next character. When there are no more characters,
  // return the empty string.
  function _next(c?: string) {
    if (c && ch !== c) _error('_next: character expected: ' + c + ', received: ' + ch);
    ch = at < lg ? text[at] : undefined;
    at += 1;
    return ch;
  }
  function _nextLine() {
    while (ch && ch !== '\n') _next();
    if (ch) { _next(); line++; atline = at; }
  }
  function _white() {
    while (ch && ch <= ' ' && ch !== '\n') _next();
  }
  // Parse a string begining and ending with ".
  function _string() {
    var str = '';
    if (ch === '"') {
      while (_next() && ch !== '"') str += ch;
    }
    else _error("Bad string");
    return str;
  }
  function _inWord() {
    return ch === '_' ||
      ('A' <= ch && ch <= 'Z') ||
      ('a' <= ch && ch <= 'z') ||
      ('0' <= ch && ch <= '9');
  }
  // _word: Parse a word as "xxx" or yyy where yyy is letters or numbers.
  function _word() {
    var str = '';
    _white();
    if (ch === '"') str = _string();
    else {
      while (_inWord()) { str += ch; _next(); }
    }
    return str;
  }
  // _type: Retourne un string ou un dico
  function _type() {
    var type: string | string[] | { [s: string]: string } = _word();
    if (!type) {
      if (ch === '{') { _next('{'); type = _inset(3); _next('}'); }
      else if (ch === '[') { _next('['); type = _inset(4); _next(']'); }
      else _error('no type');
    }
    return type;
  }
  // _inset: Retourne l'ensemble des éléments
  // ex: Si param=0, a, b, c => [a, b, c]
  // Si 1, areRefs : a, b, c => [=a, =b, =c]
  // Si 2, argTypes: a:x, b:y => [x,y]
  // Si 3, keyTypes: a:x, b:y => {a:x, b:y}
  // Si 4, arrayType: 0, *, type => [0,*,type]
  function _inset(param: 0 | 1 | 2 | 4) : string[];
  function _inset(param: 3) : { [s: string]: string };
  function _inset(param: number) {
    var areRefs = param === 1;
    var argTypes = param === 2;
    var keyTypes = param === 3;
    var arrayType = param === 4;
    var key = argTypes || keyTypes;
    var set: any = keyTypes ? {} : [];
    _white();
    while (_inWord() ||
      (arrayType && (ch === '*' || ch === '{' || ch === '[')) ||
      (keyTypes && ch === '*')) {
      var w: string | string[] | { [s: string]: string }, k: string = "";
      if (arrayType) {
        if (ch === '*') { w = '*'; _next('*'); }
        else if ('0' <= ch && ch <= '9') w = _word();
        else w = _type();
      }
      else if (keyTypes && ch === '*') { w = '*'; _next('*'); }
      else w = _word();
      _white();
      if (key) {
        k = <string>w;
        if (ch === ':') _next(':');
        else _error('bad argType');
        w = _type();
        _white();
      }
      if (keyTypes) set[k] = w;
      else if (w) set.push(areRefs ? '=' + w : w);
      if (ch === ',') _next(',');
      _white();
    }
    return set;
  }
  function _level() {
    var level = 0;
    _white();
    while (ch && ch === '#') { level++; _next(); }
    return level;
  }
  // [{Person={is:class...}},{is:class,attrs:{}},
  // [{Person={is:class,core=:{is:cat,first=:{is:meth}}}},
  //          {is:class,core=:{is:cat,first=:{is:meth}}},
  //                          {is:cat,first=:{is:meth}},
  //                                         {is:meth},

  var firstLevel = 2, currentElementType: any = null;
  var result;
  //        key:              is            |  set name      |set| sets                            | subs are ?
  var el = {
    'class': ['class', 'classes', [], ['attribute', 'category', 'farCategory', 'aspect'], ''],
    'attributes': ['attributes', '', [], [], 'attribute'],
    'attribute': ['attribute', 'attributes', [], [], ''],
    'category': ['category', 'categories', [], ['method'], 'method'],
    'farCategory': ['farCategory', 'farCategories', [], ['method'], 'method'],
    'method': ['method', 'methods', [], [], ''],
    'aspect': ['aspect', 'aspects', [], [], ''],
    'categories': ['categories', '', [], [], ''],
    'farCategories': ['farCategories', '', [], [], '']
  };

  result = [{}];
  function _pop(n) {
    while (result.length > n) {
      result.pop();
      var r = result[result.length - 1];
      var sets = r.is && el[r.is] ? el[r.is][3] : [];
      if (result.length > n) for (var i = 0; i < sets.length; i++) {
        var e = el[sets[i]];
        //console.log('pop',sets[i],e);
        if (e[2].length) { r[e[1]] = e[2]; e[2] = []; }
      }
    }
  }
  function _addObject(name) {
    var r = result[result.length - 1];
    var is = currentElementType ? currentElementType[0] : undefined;
    if (!is) _error("_addObject: element type unknonw");
    else if (is === 'attributes') result.push(r);
    else if (is === 'class' || is === 'attribute' || is === 'category' || is === 'farCategory' || is === 'method' || is === 'aspect') {
      var o = { is: is }, x: string | string[] | { [s: string]: string };
      if (!name) name = _word();
      switch (is) {
        case 'class': // : SuperClass (optionnel)
          _white();
          if (ch === ':') { _next(':'); x = _word(); if (!x) _error('superclass'); else o['superclass'] = x; }
          break;
        case 'attribute':
          _white(); _next(':'); x = _type(); if (!x) _error('type'); else o['type'] = x;
          break;
        case 'category': // [ts] (optionnel ?)
        case 'farCategory':
          _white();
          if (ch === '[') { _next('['); x = _inset(0); if (x) o['languages'] = x; _next(']'); }
          break;
        case 'method': // (a:integer, b:integer) : string
          var type = {};
          _white(); _next('('); x = _inset(2); type['arguments'] = x; _next(')');
          _white(); _next(':'); x = _type(); if (!x) _error('return type'); else type['return'] = x;
          o['type'] = type;
          break;
        default: break;
      }
      r[name + '='] = o;
      currentElementType[2].push('=' + name);
      result.push(o);
    }
    else if (is === 'categories' || is === 'farCategories') {
      _white(); _next(':');
      var set = _inset(1);
      if (set) r[is] = set;
    }
    //console.log('_addObject',result);
  }
  function _parseLine() {
    var level = _level();
    if (level >= firstLevel) {
      _pop(level - firstLevel + 1);
      var is: string | null = _word(), name: string | null = null;
      if (!is) _error("parseLine: Bad word");
      else if (el[is]) { // class attributes...
        currentElementType = el[is];
        //_white(); if (ch===':') _next();
        _addObject(null);
        currentElementType = el[currentElementType[4]];
      }
      else {
        name = is; is = null;
        _addObject(name);
      }
    }
    _nextLine();
  }

  text = source; at = 0; lg = text.length; line = 1; atline = 0; errors = [];
  for (ch = ' '; ch;) _parseLine();
  _pop(1);
  return !errors.length ? result[0] : { is: 'error', reasons: errors, uncompletedResult: result[0] };
}
