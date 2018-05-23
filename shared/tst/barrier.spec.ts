import {Barrier} from '@openmicrostep/msbuildsystem.shared';
import {assert} from 'chai';

function empty() {
  var d = 0;
  var b = new Barrier("empty");
  assert.strictEqual(d, 0);
  assert.strictEqual(b.isPending(), true);
  b.endWith(() => { d++; });
  assert.strictEqual(b.isPending(), false);
  assert.strictEqual(d, 1);
  b.break();
  assert.strictEqual(b.isPending(), false);
  assert.strictEqual(d, 1, "you can broke a barrier only once");
  b.inc();
  assert.strictEqual(b.isPending(), false);
  b.inc();
  assert.strictEqual(b.isPending(), false);
  b.inc();
  assert.strictEqual(b.isPending(), false);
}

function broke() {
  var d = 0;
  var b = new Barrier("empty");
  assert.strictEqual(b.isPending(), true);
  b.inc();
  assert.strictEqual(b.isPending(), true);
  b.break();
  assert.strictEqual(b.isPending(), false);
  assert.strictEqual(d, 0);
  b.endWith(() => { d++; });
  assert.strictEqual(b.isPending(), false);
  assert.strictEqual(d, 1);
  b.break();
  assert.strictEqual(b.isPending(), false);
  assert.strictEqual(d, 1, "you can broke a barrier only once");
}

function simple_usage() {
  var d = false;
  var b = new Barrier("simple", 2);
  assert.strictEqual(b.isPending(), true);
  b.dec();
  b.dec();
  assert.strictEqual(b.isPending(), true);
  b.endWith(() => { d = true; });
  assert.strictEqual(b.isPending(), false);
  assert.isTrue(d);

  d = false;
  b = new Barrier("simple", 2);
  assert.strictEqual(b.isPending(), true);
  b.dec();
  assert.strictEqual(b.isPending(), true);
  b.endWith(() => { d = true; });
  assert.strictEqual(b.isPending(), true);
  assert.isFalse(d);
  b.dec();
  assert.strictEqual(b.isPending(), false);
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
  assert.strictEqual(b.isPending(), true);
  b.inc();
  b.inc();
  b.endWith(() => { d = true; });
  assert.strictEqual(b.isPending(), true);
  assert.isFalse(d);
  b.decCallback()();
  assert.isFalse(d);
  assert.strictEqual(b.isPending(), true);
  b.dec();
  assert.strictEqual(b.isPending(), false);
  assert.isTrue(d);

  d = false;
  b = new Barrier("simple", 0);
  assert.strictEqual(b.isPending(), true);
  b.inc();
  assert.strictEqual(b.isPending(), true);
  b.endWith(() => { d = true; });
  assert.strictEqual(b.isPending(), true);
  assert.isFalse(d);
  b.inc();
  assert.strictEqual(b.isPending(), true);
  assert.isFalse(d);
  b.dec();
  assert.strictEqual(b.isPending(), true);
  assert.isFalse(d);
  b.decCallback()();
  assert.strictEqual(b.isPending(), false);
  assert.isTrue(d);
}

export const tests = { name: "barrier", tests: [
  { name: "empty"        , test: empty },
  { name: "simple usage" , test: simple_usage },
  { name: "dynamic usage", test: dynamic_usage },
  broke,
]};
