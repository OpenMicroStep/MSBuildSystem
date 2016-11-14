import {Barrier} from '@msbuildsystem/core';
import {assert} from 'chai';

export function tests() {

it("empty", function() {
  var d = false;
  var b = new Barrier("empty");
  b.endWith(() => { d = true; });
});

it("simple usage", function() {
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
});

it("dynamic usage", function() {
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
});

}
