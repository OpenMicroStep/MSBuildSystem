import {tests as attribtues_tests} from './attributes.spec';
import {tests as util_tests} from './util.spec';
import {tests as file_tests} from './file.spec';
import {tests as graph_tests} from './graph.spec';
import {tests as project_tests} from './project.spec';
import {tests as element_tests} from './element.spec';

export function tests() {
  describe("core", function() {
    attribtues_tests();
    util_tests();
    file_tests();
    graph_tests();
    element_tests();
    project_tests();
  });
}