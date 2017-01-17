import {Barrier} from '@msbuildsystem/core';
import {assert} from 'chai';

function empty() {
  var d = false;
  var b = new Barrier("empty");
  b.endWith(() => { d = true; });
}

function simple_usage() {
  var d = false;
  var b = new Barrier("simple", 2);
  b.dec();
  b.dec();
  b.endWith(() => { d = true; });
  assert.isTrue(d);

  d = false;
  b = new Barrier("simple", 2);
  b.dec();
  b.endWith(() => { d = true; });
  assert.isFalse(d);
  b.dec();
  assert.isTrue(d);

  d = false;
  b = new Barrier("simple", 2);
  b.endWith(() => { d = true; });
  assert.isFalse(d);
  b.dec();
  assert.isFalse(d);
  b.dec();
  assert.isTrue(d);
}

function dynamic_usage() {
  var d = false;
  var b = new Barrier("simple", 0);
  b.inc();
  b.inc();
  b.endWith(() => { d = true; });
  assert.isFalse(d);
  b.dec();
  assert.isFalse(d);
  b.dec();
  assert.isTrue(d);

  d = false;
  b = new Barrier("simple", 0);
  b.inc();
  b.endWith(() => { d = true; });
  assert.isFalse(d);
  b.inc();
  assert.isFalse(d);
  b.dec();
  assert.isFalse(d);
  b.dec();
  assert.isTrue(d);
}

export const tests = [
  { name: "empty"        , test: empty },
  { name: "simple usage" , test: simple_usage },
  { name: "dynamic usage", test: dynamic_usage },
];
