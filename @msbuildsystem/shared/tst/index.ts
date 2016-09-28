import {tests as path_tests} from './path.spec';
import {tests as util_tests} from './util.spec';

export function tests() {
  describe("shared", function() {
    path_tests();
    util_tests();
  });
}
