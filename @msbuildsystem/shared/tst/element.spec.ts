import {Element, Reporter} from '@msbuildsystem/shared';
import {assert} from 'chai';

function simple() {
  let factories = Element.createElementFactoriesProviderMap('tests');
  class RootElement extends Element {
    my_string: string;
  }

  let reporter = new Reporter();
  let root = new RootElement('root', 'root', null);
  assert.strictEqual(Element.load(reporter, {
    is: "root",
    name: "root2",
    my_string: "test"
  }, root, factories), root);
  assert.deepEqual(reporter.diagnostics, []);
  assert.strictEqual(root.name, "root");
  assert.strictEqual(root.my_string, "test");
}

export const tests = { name: "element", tests: [
  simple,
]};
