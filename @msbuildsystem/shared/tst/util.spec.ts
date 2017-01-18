import {util, Flux} from '@msbuildsystem/shared';
import {assert} from 'chai';

function formatSize() {
  assert.equal(util.formatSize(10), "10 bytes");
  assert.equal(util.formatSize(1024 * 1024), "1 megabytes");
  assert.equal(util.formatSize(1025 * 1024), "1 megabytes 1 kilobytes");
  assert.equal(util.formatSize(1025 * 1024, { format: 'short', units: 1 }), "1MB");
  assert.equal(util.formatSize(2047 * 1024, { format: 'short', units: 1 }), "1MB");
  assert.equal(util.formatSize(2048 * 1024), "2 megabytes");
  assert.equal(util.formatSize(2048 * 1024, { format: 'short' }), "2MB");
  assert.equal(util.formatSize(2049 * 1024, { format: 'short', units: 2 }), "2MB 1KB");
}
function formatDuration() {
  assert.equal(util.formatDuration(1), "1 milliseconds");
  assert.equal(util.formatDuration(1, { format: 'short' }), "1ms");
  assert.equal(util.formatDuration(1000), "1 seconds");
  assert.equal(util.formatDuration(1000, { format: 'short' }), "1s");
}
function escapeRegExp() {
  assert.equal(util.escapeRegExp("test"), "test");
  assert.equal(util.escapeRegExp("\\s+"), "\\\\s\\+");
  assert.equal(util.escapeRegExp("(\\d+|b{5,10})"), "\\(\\\\d\\+\\|b\\{5,10\\}\\)");
}
function once(f: Flux<{}>) {
  var called = 0;
  var to = 0;
  var order = 0;
  var once = util.once(function task(then) {
    ++called;
    setTimeout(function() {
      ++to;
      then();
    }, 0);
  });
  assert.equal(called, 1);
  assert.equal(to, 0);
  once(function() {
    assert.equal(order++, 0);
    assert.equal(to, 1);
    assert.equal(called, 1);
  });
  once(function() {
    assert.equal(order++, 1);
    assert.equal(to, 1);
    assert.equal(called, 1);
    f.continue();
  });
}
function deepEqual() {
  assert.equal(util.deepEqual(true, true), true);
  assert.equal(util.deepEqual(true, false), false);
  assert.equal(util.deepEqual(true, 1), false);
  assert.equal(util.deepEqual(1, 1), true);
  assert.equal(util.deepEqual(0, 1), false);
  assert.equal(util.deepEqual(164654, 164654), true);
  assert.equal(util.deepEqual(0.1, 0.1), true);
  assert.equal(util.deepEqual(0.33, 1 / 3), false);
  assert.equal(util.deepEqual("true", "true"), true);
  assert.equal(util.deepEqual("true", "true2"), false);
  assert.equal(util.deepEqual("true2", "true"), false);
  assert.equal(util.deepEqual("true2", "true2"), true);
  assert.equal(util.deepEqual("true", true), false);
  assert.equal(util.deepEqual({true: "true"}, {true: "true"}), true);
  assert.equal(util.deepEqual({true: "true"}, {true: "true2"}), false);
  assert.equal(util.deepEqual({true: [0, 1, {"3": 4}]}, {true: [0, 1, {"3": 4}]}), true);
  assert.equal(util.deepEqual({true: [0, 1, {"3": 4, "4": true}]}, {true: [0, 1, {"3": 4}]}), false);
  assert.equal(util.deepEqual({true: [0, 1, {"3": 4}]}, {true: [0, 1, {"3": 5}]}), false);
}

export const tests = { name: 'util', tests: [
  formatSize,
  formatDuration,
  escapeRegExp,
  once,
  deepEqual,
]};
