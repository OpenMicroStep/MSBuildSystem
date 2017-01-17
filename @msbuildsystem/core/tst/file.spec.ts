import {File, Flux} from '@msbuildsystem/core';
import {assert} from 'chai';

function getShared() {
  var f1 = File.getShared(__dirname + "/data/simple-project/make.js");
  var f2 = File.getShared(__dirname + "/data/simple-project//make.js");
  var d1 = File.getShared(__dirname + "/data", true);
  assert.strictEqual(f1.extension, '.js');
  assert.strictEqual(f1.name, 'make.js');
  assert.strictEqual(f1.isDirectory, false);
  assert.strictEqual(f1, f2);
  assert.strictEqual(d1.extension, '');
  assert.strictEqual(d1.name, 'data');
  assert.strictEqual(d1.isDirectory, true);
  assert.notEqual(f1, d1);
}
function stats(f: Flux<any>) {
  var f1 = File.getShared(__dirname + "/data/simple-project/make.js");
  f1.stats(function(err, stats) {
     assert.strictEqual(err, null);
     assert.strictEqual(stats.isFile(), true);
     f.continue();
  });
}

export const tests = [
  { name: "getShared", test: getShared },
  { name: "stats"    , test: stats     },
];
