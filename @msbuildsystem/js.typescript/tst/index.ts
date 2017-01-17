import {tests as helloworld_tests} from './hello-world.spec';
import {Test} from '@msbuildsystem/core';

export const tests: Test<any>[] = [
  helloworld_tests
];
