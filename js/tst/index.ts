import {tests as helloworld_tests} from './hello-world.spec';
 import {Test} from '@openmicrostep/tests';

export const name = 'js';
export const tests: Test<any>[] = [
  helloworld_tests
];
