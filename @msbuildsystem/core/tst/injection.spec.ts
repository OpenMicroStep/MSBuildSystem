import {Reporter, injectElements, injectComponentsOf, AttributePath, BuildTargetElement, Diagnostic, ComponentElement, Element} from '@openmicrostep/msbuildsystem.core/index.priv';
import {assert} from 'chai';

function mock_buildtarget() : BuildTargetElement {
  return {
    environment: { name: "a" },
    resolveElements(reporter, query: string) {
      return query.indexOf("a") !== -1 ? [this.environment] : [];
    }
  } as any;
}

function mock_element(obj: object, id: string | number) : Element {
  obj["__path"] = () => `E${id}`;
  return obj as Element;
}

function mock_component(obj: object, id: string | number) : ComponentElement {
  obj = mock_element(obj, id);
  obj["components"] = obj["components"] || [];
  return obj as ComponentElement;
}


function testInjectElements(into: object, elements: object[], diags: Diagnostic[], expect: object) {
  let reporter = new Reporter();
  injectElements(reporter, elements.map((e, i) => mock_element(e, i)), into, new AttributePath('I'), mock_buildtarget());
  assert.deepEqual(reporter.diagnostics, diags);
  assert.deepEqual(into, expect);
}

function testInjectComponentsOf(into: object, component: ComponentElement, diags: Diagnostic[], expect: object) {
  let reporter = new Reporter();
  injectComponentsOf(reporter, component, into, new AttributePath('I'), mock_buildtarget());
  assert.deepEqual(reporter.diagnostics, diags);
  delete into["components"];
  assert.deepEqual(into, expect);
}

function primitive_nocollision() {
  testInjectElements({ a: 1 }, [{ b: 3 }, { c: 4 }],
    [],
    { a: 1, b: 3, c: 4 });
}

function primitive_nocollision_undefined() {
  testInjectElements({ a: 1 }, [{ b: undefined }, { c: 4 }],
    [],
    { a: 1, b: undefined, c: 4 });
}

function primitive_nocollision_overwrite() {
  testInjectElements({ a: 1 }, [{ a: 2, b: 3 }, { a: 3, c: 4 }],
    [],
    { a: 1, b: 3, c: 4 });
}

function primitive_collision() {
  testInjectElements({ a: 1 }, [{ a: 2, b: 3 }, { a: 3, b: 4 }],
    [{ "type": "warning", "msg": "collision on I.b: attribute is removed", "path": "E1.b" }],
    { a: 1 });
}

function primitive_collision_samevalue() {
  testInjectElements({ a: 1 }, [{ a: 2, b: 3 }, { a: 3, b: 3 }],
    [],
    { a: 1, b: 3 });
}

function array() {
  testInjectElements({ a: [1] }, [{ a: [2], b: 3, d: [1, 4] }, { a: [3], c: 4, d: [2, 3] }],
    [],
    { a: [1, 2, 3], b: 3, c: 4, d: [1, 4, 2, 3] });
}

function primitive_into_array() {
  testInjectElements({ a: [1] }, [{ a: 2, b: 3 }, { a: [3], c: 4 }],
    [{ "type": "warning", "msg": "not an array: an array can only be injected to an array, ignoring", "path": "E0.a" }],
    { a: [1, 3], b: 3, c: 4 });
}

function byEnvironment() {
  testInjectElements({ a: [1] }, [{ a: [6], aByEnvironment: { "=a": [2] } }, { aByEnvironment: { "=a": [3], "=b": [4], "=a + b": [5] } }],
    [],
    { a: [1, 6, 2, 3, 5] });
}
function byEnvironment_into() {
  testInjectElements({ }, [{ aByEnvironment: { "=a": [2] } }, { aByEnvironment: { "=a": [3], "=b": [4], "=a + b": [5] } }],
    [],
    { a: [2, 3, 5] });
}
function byEnvironment_noarray() {
  testInjectElements({ b: 2 }, [{ aByEnvironment: { "=a": 2 }, bByEnvironment: { "=a": [3] } }, { aByEnvironment: { "=a": [3], "=b": [4], "=a + b": [5] } }],
    [
      { "type": "warning", "msg": "not an array: byEnvironment values must be an array, ignoring", "path": "E0.aByEnvironment[=a]" },
      { "type": "warning", "msg": "I.bByEnvironment is not array: byEnvironment attribute can only be injected to an array, ignoring", "path": "E0.bByEnvironment" },
    ],
    { b: 2, a: [3, 5] });
}

function components() {
  testInjectComponentsOf({ b: 2 }, mock_component({
    components: [
      mock_component({ b: 3, components: [
        mock_component({ a: 1 }, '000'),
      ] }, '00'),
      mock_component({ c: 4 }, '01'),
    ],
  }, '0'),
  [],
  { a: 1, b: 2, c: 4 });
}

function components_collision() {
  testInjectComponentsOf({ b: 2 }, mock_component({
    components: [
      mock_component({ b: 3, components: [
        mock_component({ a: 1 }, '000'),
        mock_component({ c: 2 }, '001'),
      ] }, '00'),
      mock_component({ c: 4 }, '01'),
    ],
  }, '0'),
  [{ "type": "warning", "msg": "collision on I.c: attribute is removed", "path": "E01.c" }],
  { a: 1, b: 2 });
}

function components_array() {
  testInjectComponentsOf({ b: 2, c: [1] }, mock_component({
    components: [
      mock_component({ b: 3, c: [2], components: [
        mock_component({ a: 1 }, '000'),
        mock_component({ c: [3] }, '001'),
      ] }, '00'),
      mock_component({ c: [4] }, '01'),
    ],
  }, '0'),
  [],
  { a: 1, b: 2, c: [1, 2, 3, 4] });
}

export const tests = { name: 'injection', tests: [
  primitive_nocollision,
  primitive_nocollision_undefined,
  primitive_nocollision_overwrite,
  primitive_collision,
  primitive_collision_samevalue,
  array,
  primitive_into_array,
  byEnvironment,
  byEnvironment_into,
  byEnvironment_noarray,
  components,
  components_collision,
  components_array,
] };
