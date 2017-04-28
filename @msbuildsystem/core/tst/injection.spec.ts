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
  let ret = new Element('element', `E${id}`, null);
  Object.assign(ret, obj);
  return ret;
}

function mock_component(obj: object, name: string) : ComponentElement {
  let ret = new ComponentElement('component', name, null);
  Object.assign(ret, obj);
  return ret;
}

function clean(a) {
  if (a && typeof a === "object") {
    delete a["components"];
    delete a["componentsByEnvironment"];
    delete a["is"];
    delete a["name"];
    delete a["tags"];
    for (let k in a)
      a[k] = clean(a[k]);
  }
  return a;
}

function testInjectElements(into: object, elements: object[], diags: Diagnostic[], expect: object) {
  let reporter = new Reporter();
  let el = mock_element(into, 'I');
  injectElements(reporter, elements.map((e, i) => mock_element(e, i)), el, new AttributePath('I'), mock_buildtarget());
  assert.deepEqual(reporter.diagnostics, diags);
  assert.deepEqual(clean(el.toJSON()), expect);
}

function testInjectComponentsOf(into: object, component: ComponentElement, diags: Diagnostic[], expect: object) {
  let reporter = new Reporter();
  let el = mock_element(into, 'I');
  injectComponentsOf(reporter, component, el, new AttributePath('I'), mock_buildtarget());
  assert.deepEqual(reporter.diagnostics, diags);
  assert.deepEqual(clean(el.toJSON()), expect);
}

function testInjectComponents(into: object, components: ComponentElement[], diags: Diagnostic[], expect: object) {
  let reporter = new Reporter();
  let el = mock_element(into, 'I');
  injectComponentsOf(reporter, { components: components }, el, new AttributePath('I'), mock_buildtarget());
  assert.deepEqual(reporter.diagnostics, diags);
  assert.deepEqual(clean(el.toJSON()), expect);
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

function array_into() {
  testInjectElements({ a: 2 }, [{ b: 3 }, { a: [3], c: 4 }],
    [{ "type": "warning", "msg": "I.a is not array: an array can only be injected to an array, ignoring", "path": "E1.a" }],
    { a: 2, b: 3, c: 4 });
}

function array_collision() {
  testInjectElements({ a: [1] }, [{ a: 2, b: 3 }, { a: [3], c: 4 }],
    [{ "type": "warning", "msg": "not an array: an array can only be injected to an array, ignoring", "path": "E0.a" }],
    { a: [1, 3], b: 3, c: 4 });
}

function array_collision_into() {
  testInjectElements({ }, [{ a: 2, b: 3 }, { a: [3], c: 4 }],
    [{ "type": "warning", "msg": "collision on I.a: attribute is removed", "path": "E1.a" }],
    { b: 3, c: 4 });
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
  testInjectElements({ b: 2 }, [
      { aByEnvironment: { "=a": 2 }, bByEnvironment: { "=a": [3] }, c: 3 },
      { aByEnvironment: { "=a": [3], "=b": [4], "=a + b": [5] }, cByEnvironment: { "=a": [4] }, dByEnvironment: 4 },
    ],
    [
      { "type": "warning", "msg": "not an array: byEnvironment values must be an array, ignoring", "path": "E0.aByEnvironment[=a]" },
      { "type": "warning", "msg": "I.b is not array: byEnvironment attribute can only be injected to an array, ignoring", "path": "E0.bByEnvironment" },
      { "type": "warning", "msg": "collision on I.c: attribute is removed", "path": "E1.cByEnvironment" },
      { "type": "warning", "msg": "not an object: byEnvironment attribute must be an object (ie: { \"=env\": [values] }), ignoring", "path": "E1.dByEnvironment" },
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
  [{ "type": "warning", "msg": "collision on I.c: attribute is removed", "path": "01.c" }],
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

function components_subs() {
  testInjectComponents({
    a: mock_component({ b: 1 }, "I.a"),
    l: mock_component({ b: [1] }, "I.l"),
    r: mock_component({ b: mock_component({ b: [1] }, "I.r.b") }, "I.r"),
    x: [mock_component({ b: mock_component({ b: [1] }, "I.x0.b") }, "I.x0")],
  },
  [mock_component({
    a: mock_component({ b: 2, c: 3 }, "0.a"),
    l: mock_component({ b: [2] }, "0.l"),
    r: mock_component({ b: mock_component({ b: [2] }, "0.r.b") }, "0.r"),
    x: [mock_component({ b: mock_component({ b: [2] }, "0.x0.b") }, "0.x0")],
    components: [
      mock_component({
        a: mock_component({ b: 3, c: 4, d: 5 }, "00.a"),
        l: mock_component({ b: [3] }, "00.l"),
        r: mock_component({ b: mock_component({ b: [3] }, "00.r.b") }, "00.r"),
        x: [mock_component({ b: mock_component({ b: [3] }, "00.x0.b") }, "00.x0")],
      }, "00"),
      mock_component({
        a: mock_component({ b: 3, c: 4, e: 6 }, "01.a"),
        l: mock_component({ components: [
          mock_component({ b: [4] }, "01.l0"),
        ]}, "01.l"),
        r: mock_component({ components: [
          mock_component({ b: mock_component({ b: [4] }, "01.r0.b") }, "01.r0"),
        ]}, "01.r"),
        x: [mock_component({ components: [
          mock_component({ b: mock_component({ b: [4] }, "01.x00.b") }, "01.x00"),
        ]}, "01.x0")],
      }, "01"),
    ]
  }, '0')],
  [],
  {
    a: { b: 1, c: 3, d: 5, e: 6 },
    l: { b: [1, 2, 3, 4]},
    r: { b: { b: [1, 2, 3, 4]} },
    x: [{ b: { b: [1] } }, { b: { b: [2] } }, { b: { b: [3] } }, { b: { b: [4] } }],
  });
}

export const tests = { name: 'injection', tests: [
  primitive_nocollision,
  primitive_nocollision_undefined,
  primitive_nocollision_overwrite,
  primitive_collision,
  primitive_collision_samevalue,
  array,
  array_into,
  array_collision,
  array_collision_into,
  byEnvironment,
  byEnvironment_into,
  byEnvironment_noarray,
  components,
  components_collision,
  components_array,
  components_subs,
] };
