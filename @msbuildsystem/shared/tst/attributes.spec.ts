import {AttributeTypes, Reporter, AttributePath, Diagnostic} from '@openmicrostep/msbuildsystem.shared';
import {assert} from 'chai';

function testValidator<T, A0>(validator: AttributeTypes.Validator<T, A0>, value: any, a0: A0, expected: T | undefined, diagnostics: Diagnostic[]) {
  let reporter = new Reporter();
  let path = new AttributePath();
  let v = validator.validate(reporter, path, value, a0);
  if (expected instanceof Set) {
    assert.instanceOf(v, Set);
    expected = <any>Array.from(expected.values());
    v = <any>Array.from((<any>v as Set<any>).values());
  }
  if (expected instanceof Map) {
    assert.instanceOf(v, Map);
    expected = <any>Array.from(expected.entries());
    v = <any>Array.from((<any>v as Map<any, any>).entries());
  }
  assert.notInstanceOf(v, Set);
  assert.notInstanceOf(v, Map);
  assert.deepEqual(v, expected);
  assert.deepEqual(reporter.diagnostics, diagnostics);
}

function validateAny() {
  testValidator(AttributeTypes.validateAny, undefined, undefined, undefined, []);
  testValidator(AttributeTypes.validateAny, true, undefined, true, []);
  testValidator(AttributeTypes.validateAny, false, undefined, false, []);
  testValidator(AttributeTypes.validateAny, "mystring", undefined, "mystring", []);
  testValidator(AttributeTypes.validateAny, ["myarray"], undefined, ["myarray"], []);
  testValidator(AttributeTypes.validateAny, { "mykey": ["myarray"] }, undefined, { "mykey": ["myarray"] }, []);
}
function validateAnyToUndefined() {
  testValidator(AttributeTypes.validateAnyToUndefined, undefined, undefined, undefined, []);
  testValidator(AttributeTypes.validateAnyToUndefined, true, undefined, undefined, []);
  testValidator(AttributeTypes.validateAnyToUndefined, false, undefined, undefined, []);
  testValidator(AttributeTypes.validateAnyToUndefined, "mystring", undefined, undefined, []);
  testValidator(AttributeTypes.validateAnyToUndefined, ["myarray"], undefined, undefined, []);
  testValidator(AttributeTypes.validateAnyToUndefined, { "mykey": ["myarray"] }, undefined, undefined, []);
}
function validateString() {
  testValidator(AttributeTypes.validateString, 'this is a string', undefined, 'this is a string', []);
  testValidator(AttributeTypes.validateString, { t: 'this is not a string' }, undefined, undefined, [
    {"type": "warning", "msg": "attribute must be a string, got object" }
  ]);
  testValidator(AttributeTypes.validateString, '', undefined, undefined, [
    {"type": "warning", "msg": "attribute can't be an empty string" }
  ]);
}
function validateObject() {
  testValidator(AttributeTypes.validateObject, { o: 1 }, undefined, { o: 1 }, []);
  testValidator(AttributeTypes.validateObject, 'this is a string', undefined, undefined, [
    {"type": "warning", "msg": "attribute must be an object, got string" }
  ]);
  testValidator(AttributeTypes.validateObject, {}, undefined, {}, []);
}
function validateArray() {
  testValidator(AttributeTypes.validateArray, [1, 2, 3], undefined, [1, 2, 3], []);
  testValidator(AttributeTypes.validateArray, 'this is a string', undefined, [], [
    {"type": "warning", "msg": "attribute must be an array" }
  ]);
  testValidator(AttributeTypes.validateArray, [], undefined, [], []);
}
function validateBoolean() {
  testValidator(AttributeTypes.validateBoolean, true, undefined, true, []);
  testValidator(AttributeTypes.validateBoolean, false, undefined, false, []);
  testValidator(AttributeTypes.validateBoolean, 'this is a string', undefined, undefined, [
    {"type": "warning", "msg": "attribute must be a boolean, got string" }
  ]);
}
function validateStringList() {
  testValidator(AttributeTypes.validateStringList, ['this is a string'], undefined, ['this is a string'], []);
  testValidator(AttributeTypes.validateStringList, ['0', '1'], undefined, ['0', '1'], []);
  testValidator(AttributeTypes.validateStringList, [{ t: 'this is not a string' }], undefined, [], [
    {"type": "warning", "msg": "attribute must be a string, got object", "path": "[0]" }
  ]);
  testValidator(AttributeTypes.validateStringList, ['0', { t: 'this is not a string' }], undefined, ['0'], [
    {"type": "warning", "msg": "attribute must be a string, got object", "path": "[1]" }
  ]);
  testValidator(AttributeTypes.validateStringList, ['0', '', 1], undefined, ['0'], [
    {"type": "warning", "msg": "attribute can't be an empty string", "path": "[1]" },
    {"type": "warning", "msg": "attribute must be a string, got number", "path": "[2]" }
  ]);
  testValidator(AttributeTypes.validateStringList, '', undefined, [], [
    {"type": "warning", "msg": "attribute must be an array" }
  ]);
}
function validateStringSet() {
  testValidator(AttributeTypes.validateStringSet, ['this is a string'], undefined, new Set(['this is a string']), []);
  testValidator(AttributeTypes.validateStringSet, ['0', '1'], undefined, new Set(['0', '1']), []);
  testValidator(AttributeTypes.validateStringSet, [{ t: 'this is not a string' }], undefined, new Set<string>([]), [
    {"type": "warning", "msg": "attribute must be a string, got object", "path": "[0]" }
  ]);
  testValidator(AttributeTypes.validateStringSet, ['0', { t: 'this is not a string' }], undefined, new Set(['0']), [
    {"type": "warning", "msg": "attribute must be a string, got object", "path": "[1]" }
  ]);
  testValidator(AttributeTypes.validateStringSet, ['0', '', 1], undefined, new Set(['0']), [
    {"type": "warning", "msg": "attribute can't be an empty string", "path": "[1]" },
    {"type": "warning", "msg": "attribute must be a string, got number", "path": "[2]" }
  ]);
  testValidator(AttributeTypes.validateStringSet, '', undefined, new Set([]), [
    {"type": "warning", "msg": "attribute must be an array" }
  ]);
}

function chain() {
  testValidator(AttributeTypes.chain(AttributeTypes.validateArray, AttributeTypes.validateStringList), ['this is a string'], undefined, ['this is a string'], []);
  testValidator(AttributeTypes.chain(AttributeTypes.validateArray, AttributeTypes.validateString), ['this is a string'], undefined, undefined, [
    { "type": "warning", "msg": "attribute must be a string, got object" }
  ]);
}

function defaultsTo() {
  testValidator(AttributeTypes.defaultsTo(AttributeTypes.validateString, 'default string value'), 'this is a string', undefined, 'this is a string', []);
  testValidator(AttributeTypes.defaultsTo(AttributeTypes.validateString, 'default string value'), undefined, undefined, 'default string value', []);
  testValidator(AttributeTypes.defaultsTo(AttributeTypes.validateString, 'default string value'), { t: 'this is not a string' }, undefined, 'default string value', [
    { "type": "warning", "msg": "attribute must be a string, got object" }
  ]);
}
function listValidator() {
  let validator = AttributeTypes.listValidator(AttributeTypes.validateString);
  testValidator(validator, ['this is a string'], undefined, ['this is a string'], []);
  testValidator(validator, ['0', '1'], undefined, ['0', '1'], []);
  testValidator(validator, [{ t: 'this is not a string' }], undefined, [], [
    {"type": "warning", "msg": "attribute must be a string, got object", "path": "[0]" }
  ]);
  testValidator(validator, ['0', { t: 'this is not a string' }], undefined, ['0'], [
    {"type": "warning", "msg": "attribute must be a string, got object", "path": "[1]" }
  ]);
  testValidator(validator, ['0', '', 1], undefined, ['0'], [
    {"type": "warning", "msg": "attribute can't be an empty string", "path": "[1]" },
    {"type": "warning", "msg": "attribute must be a string, got number", "path": "[2]" }
  ]);
  testValidator(validator, '', undefined, [], [
    {"type": "warning", "msg": "attribute must be an array" }
  ]);
}
function setValidator() {
  let validator = AttributeTypes.setValidator(AttributeTypes.validateString);
  testValidator(validator, ['this is a string'], undefined, new Set(['this is a string']), []);
  testValidator(validator, ['0', '1'], undefined, new Set(['0', '1']), []);
  testValidator(validator, [{ t: 'this is not a string' }], undefined, new Set([]), [
    {"type": "warning", "msg": "attribute must be a string, got object", "path": "[0]" }
  ]);
  testValidator(validator, ['0', { t: 'this is not a string' }], undefined, new Set(['0']), [
    {"type": "warning", "msg": "attribute must be a string, got object", "path": "[1]" }
  ]);
  testValidator(validator, ['0', '', 1], undefined, new Set(['0']), [
    {"type": "warning", "msg": "attribute can't be an empty string", "path": "[1]" },
    {"type": "warning", "msg": "attribute must be a string, got number", "path": "[2]" }
  ]);
  testValidator(validator, '', undefined, new Set([]), [
    {"type": "warning", "msg": "attribute must be an array" }
  ]);
}
function objectValidator() {
  let validator = AttributeTypes.objectValidator({
    's': AttributeTypes.defaultsTo(AttributeTypes.validateString, 'a string') ,
    'b': AttributeTypes.defaultsTo(AttributeTypes.validateBoolean, false) ,
  });
  let validator2 = AttributeTypes.objectValidator({
    's': AttributeTypes.defaultsTo(AttributeTypes.validateString, 'a') ,
    'b': AttributeTypes.defaultsTo(AttributeTypes.validateString, 'b') ,
  }, AttributeTypes.validateString);
  testValidator(validator, { s: 'test', b: true }, undefined, { s: 'test', b: true }, []);
  testValidator(validator, { s: 'test' }, undefined, { s: 'test', b: false }, []);
  testValidator(validator, { s: 0 }, undefined, { s: 'a string', b: false }, [
    { "type": "warning", "msg": "attribute must be a string, got number", "path": ".s" }
  ]);
  testValidator(validator, { }, undefined, { s: 'a string', b: false }, []);
  testValidator(validator, { not_defined: 0 }, undefined, { s: 'a string', b: false }, [
    { "type": "warning", "msg": "attribute is unused", "path": ".not_defined" }
  ]);
  testValidator(validator2, { not_defined: "test" }, undefined, { s: 'a', b: 'b', not_defined: "test" }, []);
  testValidator(validator2, { not_defined: 0 }, undefined, { s: 'a', b: 'b' }, [
    { "type": "warning", "msg": "attribute must be a string, got number", "path": ".not_defined" }
  ]);
}

export const tests = { name: 'attributes', tests: [
  validateAny,
  validateAnyToUndefined,
  validateString,
  validateObject,
  validateArray,
  validateBoolean,
  validateStringList,
  validateStringSet,
  chain,
  defaultsTo,
  listValidator,
  objectValidator,
  setValidator
]};
