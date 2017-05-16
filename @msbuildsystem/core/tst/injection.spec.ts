import {Reporter, injectElements, AttributePath, BuildTargetElement, Diagnostic, ComponentElement, Element, createInjectionContext, closeInjectionContext} from '@openmicrostep/msbuildsystem.core/index.priv';
import {assert} from 'chai';

const env = { name: "a" };
function mock_buildtarget() : BuildTargetElement {
  return {
    environment: env,
  } as any;
}

function mock_component(obj: object, name: string) : ComponentElement {
  let ret = new ComponentElement('component', name, null);
  Object.assign(ret, obj);
  Object.defineProperty(ret, "resolveElements", {
    enumerable: false,
    value: (reporter, query: string) => {
      return query.indexOf("a") !== -1 ? [env as any] : [];
    }
  });
  return ret;
}

function clean(a) {
  if (a instanceof Element) {
    let r = {};
    for (let k in a) {
      if (!a.__keyMeaning(k))
        r[k] = clean(a[k]);
    }
    a = r;
  }
  else if (a instanceof Array) {
    a = a.map(v => clean(v));
  }
  else if (a instanceof Set) {
    a = [Set, ...a].map(v => clean(v));
  }
  return a;
}

function testInjectElements(into: object, elements: object[], diags: Diagnostic[], expect: object) {
  let reporter = new Reporter();
  let el = mock_component(into, 'I');
  let ctx = createInjectionContext(reporter, mock_buildtarget());
  injectElements(ctx, elements.map((e, i) => mock_component(e, `E${i}`)), el, new AttributePath('I'));
  closeInjectionContext(ctx);
  assert.deepEqual(reporter.diagnostics, diags);
  let c = clean(el);
  assert.deepEqual(c, expect);
}

function testInjectElement(into: object, element: Element, diags: Diagnostic[], expect: object) {
  let reporter = new Reporter();
  let el = mock_component(into, 'I');
  let ctx = createInjectionContext(reporter, mock_buildtarget());
  injectElements(ctx, [element], el, new AttributePath('I'));
  closeInjectionContext(ctx);
  assert.deepEqual(reporter.diagnostics, diags);
  let c = clean(el);
  assert.deepEqual(c, expect);
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

function primitive_collision() {
  testInjectElements({ a: 1 }, [{ a: 2, b: 3 }, { a: 3, b: 4 }], [
      { "type": "warning", "msg": "collision: attribute is removed", "path": "I.a", notes: [
        { type: "note", msg: 'caused collision while merging', path: "E0.a"},
        { type: "note", msg: 'while merging', path: "E1.a"}] },
      { "type": "warning", "msg": "collision: attribute is removed", "path": "I.b", notes: [
        { type: "note", msg: 'while merging', path: "E0.b" },
        { type: "note", msg: 'caused collision while merging', path: "E1.b"}] }
    ], {});
}

function primitive_collision_samevalue() {
  testInjectElements({ a: 1 }, [{ b: 3 }, { b: 3 }],
    [],
    { a: 1, b: 3 });
}

function array() {
  testInjectElements({ a: [1] }, [{ a: [2], b: 3, d: [1, 4] }, { a: [3], c: 4, d: [2, 3], e: [1] }],
    [],
    { a: ([Set, 1, 2, 3]), b: 3, c: 4, d: ([Set, 1, 4, 2, 3]), e: [Set, 1] });
}

function array_into() {
  testInjectElements({ a: 2 }, [{ b: 3 }, { a: [3], c: 4 }],
    [{ "type": "warning", "msg": "collision: attribute is removed", "path": "I.a", notes: [
      { type: "note", msg: 'caused collision while merging', path: "E1.a"}] }],
    { b: 3, c: 4 });
}

function array_collision() {
  testInjectElements({ a: [1] }, [{ a: 2, b: 3 }, { a: [3], c: 4 }], [
    { "type": "warning", "msg": "collision: attribute is removed", "path": "I.a", notes: [
      { type: "note", msg: 'caused collision while merging', path: "E0.a"},
      { type: "note", msg: 'while merging', path: "E1.a"}] },
    ], { b: 3, c: 4 });
}

function array_collision_into() {
  testInjectElements({ }, [{ a: 2, b: 3 }, { a: [3], c: 4 }],
    [{ "type": "warning", "msg": "collision: attribute is removed", "path": "I.a", notes: [
      { type: "note", msg: 'while merging', path: "E0.a"},
      { type: "note", msg: 'caused collision while merging', path: "E1.a"}] }],
    { b: 3, c: 4 });
}

function byEnvironment() {
  testInjectElements({ a: [1] }, [{ a: [6], aByEnvironment: { "=a": [2] } }, { aByEnvironment: { "=a": [3], "=b": [4], "=a + b": [5] } }],
    [],
    { a: ([Set, 1, 6, 2, 3, 5]) });
}
function byEnvironment_into() {
  testInjectElements({ }, [{ aByEnvironment: { "=a": [2] } }, { aByEnvironment: { "=a": [3], "=b": [4], "=a + b": [5] } }],
    [],
    { a: ([Set, 2, 3, 5]) });
}
function byEnvironment_noarray() {
  testInjectElements({ b: 2 }, [
      { aByEnvironment: { "=a": 2 }, bByEnvironment: { "=a": [3] }, c: 3 },
      { aByEnvironment: { "=a": [3], "=b": [4], "=a + b": [5] }, cByEnvironment: { "=a": [4] }, dByEnvironment: 4, e: 5 },
    ], [
    { "type": "warning", "msg": "not an object: ByEnvironment attribute must be an object (ie: { \"=env\": [values] }), ignoring", "path": "E1.dByEnvironment" },
    { "type": "warning", "msg": "collision: attribute is removed", "path": "I.b", notes: [
      { type: "note", msg: `caused collision while merging`, path: "E0.bByEnvironment[=a]" }] },
    { "type": "warning", "msg": "collision: attribute is removed", "path": "I.a", notes: [
      { type: "note", msg: `while merging`, path: "E0.aByEnvironment[=a]" },
      { type: "note", msg: `caused collision while merging`, path: "E1.aByEnvironment[=a]" },
      { type: "note", msg: `while merging`, path: "E1.aByEnvironment[=a + b]" }] },
    { "type": "warning", "msg": "collision: attribute is removed", "path": "I.c", notes: [
      { type: "note", msg: `while merging`, path: "E0.c" },
      { type: "note", msg: `caused collision while merging`, path: "E1.cByEnvironment[=a]" }] },
    ], {  e: 5 });
}

function components() {
  testInjectElement({ b: 2 }, mock_component({
    components: [
      mock_component({ d: 3, components: [
        mock_component({ a: 1 }, '000'),
      ] }, '00'),
      mock_component({ c: 4 }, '01'),
    ],
  }, '0'),
  [],
  { a: 1, b: 2, c: 4, d: 3 });
}

function components_collision() {
  testInjectElement({ b: 2 }, mock_component({
    components: [
      mock_component({ b: 3, components: [
        mock_component({ a: 1 }, '000'),
        mock_component({ c: 2 }, '001'),
      ] }, '00'),
      mock_component({ c: 4 }, '01'),
    ],
  }, '0'), [
  { "type": "warning", "msg": "collision: attribute is removed", "path": "I.b", notes: [
    { type: "note", msg: 'caused collision while merging', path: "00.b"}] },
  { "type": "warning", "msg": "collision: attribute is removed", "path": "I.c", notes: [
    { type: "note", msg: 'while merging', path: "001.c"},
    { type: "note", msg: 'caused collision while merging', path: "01.c"}] },
  ], { a: 1 });
}

function components_array() {
  testInjectElement({ b: 2, c: [1] }, mock_component({
    components: [
      mock_component({ c: [2], components: [
        mock_component({ a: 1 }, '000'),
        mock_component({ c: [3] }, '001'),
      ] }, '00'),
      mock_component({ c: [4] }, '01'),
    ],
  }, '0'),
  [],
  { a: 1, b: 2, c: ([Set, 1, 2, 3, 4]) });
}

function components_sub() {
  testInjectElement({
    a:  mock_component({ b: 1 }, "I.a" ) ,
  },
  mock_component({
    a:  mock_component({ b: 2, c: 3 }, "0.a" ) ,
    components: [
      mock_component({
        a:  mock_component({ b: 3, c: 4, d: 5 }, "00.a" ) ,
      }, "00"),
      mock_component({
        a:  mock_component({
          components: [mock_component({ b: 3, c: 4, e: 6 }, "01.a0" )],
          componentsByEnvironment: { "=a": [mock_component({ f: 7 }, "01.a1" )] }
        }, "01.a" ),
      }, "01"),
    ]
  }, '0'), [
  { "type": "warning", "msg": "collision: attribute is removed", "path": "I.a.b", notes: [
    { type: "note", msg: 'caused collision while merging', path: "0.a.b"},
    { type: "note", msg: 'while merging', path: "00.a.b"},
    { type: "note", msg: 'while merging', path: "01.a0.b"}] },
  { "type": "warning", "msg": "collision: attribute is removed", "path": "I.a.c", notes: [
    { type: "note", msg: 'while merging', path: "0.a.c"},
    { type: "note", msg: 'caused collision while merging', path: "00.a.c"},
    { type: "note", msg: 'while merging', path: "01.a0.c"}] },
  ], {
    a: { d: 5, e: 6, f: 7 },
  });
}

function components_subarr() {
  testInjectElement({
    l:  mock_component({ b: [1]}, "I.l" ) ,
  },
  mock_component({
    l:  mock_component({ b: [2]}, "0.l" ) ,
    components: [
      mock_component({
        l:  mock_component({ b: [3]}, "00.l" ) ,
      }, "00"),
      mock_component({
        l:  mock_component({ components: [mock_component({ b: [4]}, "01.l0" )] }, "01.l" ) ,
      }, "01"),
    ]
  }, '0'), [
  ], {
    l: { b: ([Set, 1, 2, 3, 4])},
  });
}
function components_subsubarr() {
  testInjectElement({
    r:  mock_component({ b: mock_component({ b: [1] }, "I.r.b")  }, "I.r" ) ,
  },
  mock_component({
    r:  mock_component({ b: mock_component({ b: [2] }, "0.r.b")  }, "0.r" ) ,
    components: [
      mock_component({
        r:  mock_component({ b: mock_component({ b: [3] }, "00.r.b")  }, "00.r" ) ,
      }, "00"),
      mock_component({
        r: mock_component({ components: [mock_component({ b: mock_component({ b: [4] }, "01.r00.b") }, "01.r00")] }, "01.r0"),
      }, "01"),
    ]
  }, '0'), [
  ], {
    r: { b: { b: ([Set, 1, 2, 3, 4])} },
  });
}
function components_arrsubsubarr() {
  testInjectElement({
    x: [mock_component({ b: mock_component({ b: [1] }, "I.x0.b") }, "I.x0")],
  },
  mock_component({
    x: [mock_component({ b: mock_component({ b: [2] }, "0.x0.b") }, "0.x0")],
    components: [
      mock_component({
        x: [mock_component({ b: mock_component({ b: [3] }, "00.x0.b") }, "00.x0")],
      }, "00"),
      mock_component({
        x: [mock_component({ components: [mock_component({ b: mock_component({ b: [4] }, "01.x00.b") }, "01.x00")] }, "01.x0")],
      }, "01"),
    ]
  }, '0'), [
  ], {
    x: ([Set, { b: { b: [1] } }, { b: { b: [Set, 2] } }, { b: { b: [Set, 3] } }, { b: { b: [Set, 4] } }]),
  });
}

export const tests = { name: 'injection', tests: [
  primitive_nocollision,
  primitive_nocollision_undefined,
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
  components_sub,
  components_subarr,
  components_subsubarr,
  components_arrsubsubarr,
] };
