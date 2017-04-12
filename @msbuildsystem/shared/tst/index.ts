import {tests as barrier_tests} from './barrier.spec';
import {tests as path_tests} from './path.spec';
import {tests as util_tests} from './util.spec';
import {tests as attribute_path_tests} from './attribute-path.spec';
import {tests as attributes_tests} from './attributes.spec';
import {tests as parser_tests} from './parser.spec';
import {tests as element_tests} from './element.spec';
import {Test} from '@openmicrostep/tests';

export const name = 'shared';
export const tests = <Test<any>[]>[
  path_tests,
  util_tests,
  attribute_path_tests,
  attributes_tests,
  parser_tests,
  barrier_tests,
  element_tests
];
