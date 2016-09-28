import {tests as attributes_tests} from './attributes.spec';
import {tests as util_tests} from './util.spec';
import {tests as file_tests} from './file.spec';
import {tests as graph_tests} from './graph.spec';
import {tests as project_tests} from './project.spec';
import {tests as element_tests} from './element.spec';

export function tests() {
  describe('attributes', attributes_tests);
  describe('util', util_tests);
  describe('file', file_tests);
  describe('graph', graph_tests);
  describe('element', element_tests);
  describe('project', project_tests);
}
