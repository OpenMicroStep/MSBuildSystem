import {tests as util_tests} from './util.spec';
import {tests as file_tests} from './file.spec';
import {tests as graph_tests} from './graph.spec';
import {tests as project_tests} from './project.spec';
import {tests as element_tests} from './element.spec';
import {Test} from '@microstep/tests';

export const name = 'core';
export const tests = <Test<any>[]>[
  { name: 'util'      , tests: util_tests       },
  { name: 'file'      , tests: file_tests       },
  { name: 'graph'     , tests: graph_tests      },
  { name: 'element'   , tests: element_tests    },
  { name: 'project'   , tests: project_tests    },
];
