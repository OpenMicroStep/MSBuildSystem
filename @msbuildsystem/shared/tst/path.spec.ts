import {path} from '@msbuildsystem/shared';
import {assert} from 'chai';

function basename() {
  assert.equal(path.basename("test/abc.ext"), "abc.ext");
}
function formatDuration() {
  assert.equal(path.extname("test/abc.ext"), ".ext");
}

export const tests = { name: 'path', tests: [basename, formatDuration]};
