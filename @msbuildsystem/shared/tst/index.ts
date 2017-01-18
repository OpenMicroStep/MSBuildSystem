import {tests as path_tests} from './path.spec';
import {tests as util_tests} from './util.spec';
import {tests as attribute_path_tests} from './attribute-path.spec';
import {tests as attributes_tests} from './attributes.spec';
import {Test} from '@msbuildsystem/shared';

export const tests = <Test<any>[]>[path_tests, util_tests, attribute_path_tests, attributes_tests];
