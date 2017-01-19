import {tests as helloworld_tests} from './hello-world.spec';
import {Test} from '@microstep/tests';

export const name = 'cxx';
export const tests = <Test<any>[]>[
  { name: "hello-world", tests: helloworld_tests }
];
