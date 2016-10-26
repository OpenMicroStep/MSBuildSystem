import {tests as helloworld_tests} from './hello-world.spec';
import {tests as msfoundation_tests} from './microstep.spec';

export function tests() {
  describe("hello-world", helloworld_tests);
  describe("msfoundation", msfoundation_tests);
}
