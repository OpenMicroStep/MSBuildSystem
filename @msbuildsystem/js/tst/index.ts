import {tests as helloworld_tests} from './hello-world.spec';
 import {Test} from '@microstep/tests';

export const name = 'js';
export const tests: Test<any>[] = [
  helloworld_tests
];
