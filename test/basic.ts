/// <reference path="../type_declarations/index.d.ts" />
import * as assert from 'assert';
import * as types from '../types';
import * as generalize from '../index';

function assertEqualSchemas(actual: types.Schema[], expected: types.Schema[]) {
  // FIXME: this should test equality as sets
  assert.deepEqual(actual, expected);
}

describe('basic object generalization', () => {

  it('should collapse number types', () => {
    var actual = generalize.generalizeArray([
      100,
      -90,
      45,
      3.14159,
    ]);
    assertEqualSchemas(actual, [{
      type: 'number',
    }]);
  });

  it('should collapse string types', () => {
    var actual = generalize.generalizeArray([
      'I could',
      'not',
      'care',
      'less!',
    ]);
    assertEqualSchemas(actual, [{
      type: 'string',
    }]);
  });

  it('should collapse identical object types', () => {
    var actual = generalize.generalizeArray([
      {
        name: 'Curious George',
        age: 5,
      },
      {
        name: 'Mark Bedelman',
        age: 47,
      },
    ]);
    assertEqualSchemas(actual, [{
      type: 'object',
      properties: {
        name: [{
          type: 'string',
        }],
        age: [{
          type: 'number',
        }],
      },
    }]);
  });

  it('should build array from distinct object types', () => {
    var actual = generalize.generalizeArray([
      'incredible',
      800
    ]);
    assertEqualSchemas(actual, [{
      type: 'string',
    }, {
      type: 'number',
    }]);
  });

  it('should build array from objects with distinct property sets', () => {
    var actual = generalize.generalizeArray([
      {
        name: 'Curious George',
        age: 5,
      },
      {
        breed: 'Schnauzer',
        age: false,
      },
    ]);
    assertEqualSchemas(actual, [{
      type: 'object',
      properties: {
        name: [{
          type: 'string',
        }],
        breed: [{
          type: 'string',
        }],
        age: [{
          type: 'number',
        }, {
          type: 'boolean',
        }],
      },
    }]);
  });

  it('should build array schema from objects with identical object types but different lengths', () => {
    var actual = generalize.generalizeArray([
      [
        { name: 'Curious George', email: 'cgeorge@example.org'}
      ],
      [
        { name: 'Bran Kurtz', email: 'bkurtz@example.org'},
        { name: 'Kev Bravado', email: 'kbravado@example.org'},
      ],
    ]);
    assertEqualSchemas(actual, [{
      type: 'array',
      items: [{
        type: 'object',
        properties: {
          name: [{
            type: 'string',
          }],
          email: [{
            type: 'string',
          }],
        },
      }],
    }]);
  });

});
