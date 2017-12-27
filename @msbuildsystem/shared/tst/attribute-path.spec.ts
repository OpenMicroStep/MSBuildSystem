import {PathReporter, Reporter} from '@openmicrostep/msbuildsystem.shared';
import {assert} from 'chai';

function path_tracking() {
  var p = new PathReporter(new Reporter());
  assert.strictEqual(p.toString(), '');
  assert.strictEqual(p.push("root").toString(), 'root');
  assert.strictEqual(p.push(":sub").toString(), 'root:sub');
  assert.strictEqual(p.copy().push(".sub2").toString(), 'root:sub.sub2');
  assert.strictEqual(p.pushArray().toString(), 'root:sub[]');
  assert.strictEqual(p.setArrayKey(2).toString(), 'root:sub[2]');
  assert.strictEqual(p.popArray().toString(), 'root:sub');
  assert.strictEqual(p.pop().toString(), 'root');
  assert.strictEqual(p.reset('test', '.', 'test2').toString(), 'test.test2');
}

export const tests = { name: 'PathReporter', tests: [
  path_tracking
]};
