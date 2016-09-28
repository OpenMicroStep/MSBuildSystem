import {path} from '@msbuildsystem/shared';
import {assert} from 'chai';

export function tests() {
  describe('path', function() {

it("basename", function() {
  assert.equal(path.basename("test/abc.ext"), "abc.ext");
});
it("formatDuration", function() {
  assert.equal(path.extname("test/abc.ext"), ".ext");
});

  });
}
