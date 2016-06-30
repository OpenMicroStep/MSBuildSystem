import {AttributePath} from '../core';
import {assert} from 'chai';

export function tests() {
  describe('attributes', function() {
    
it("AttributePath", function() {
  var p = new AttributePath();
  assert.strictEqual(p.toString(), '');
  assert.strictEqual(p.push("root").toString(), 'root');
  assert.strictEqual(p.push("sub").toString(), 'root:sub');
  assert.strictEqual(p.copy().push(".sub2").toString(), 'root:sub.sub2');
  p.push('[', '', ']');
  assert.strictEqual(p.toString(), 'root:sub[]');
  p.set(<any>2, -2);
  assert.strictEqual(p.toString(), 'root:sub[2]');
  p.pop(3);
  assert.strictEqual(p.toString(), 'root:sub');
  p.pop();
  assert.strictEqual(p.toString(), 'root');
})

  });
}