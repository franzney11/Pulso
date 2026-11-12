'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { compareVersions } = require('../src/main/drivers/versions');
const { statusFrom } = require('../src/main/drivers');

test('compara versiones numéricas de driver', () => {
  assert.equal(compareVersions('581.57', '581.80'), -1);
  assert.equal(compareVersions('581.80', '581.57'), 1);
  assert.equal(compareVersions('581.80', '581.80'), 0);
  assert.equal(compareVersions('6.07.22.222', '6.10.0.1'), -1);
  assert.equal(compareVersions('6.10', '6.10.0.0'), 0, 'los ceros que faltan no cuentan');
  assert.equal(compareVersions('10.0', '9.99'), 1, 'compara por números, no por texto');
});

test('devuelve null si falta alguna versión', () => {
  assert.equal(compareVersions(null, '1.0'), null);
  assert.equal(compareVersions('1.0', ''), null);
  assert.equal(compareVersions('abc', '1.0'), null);
});

test('estado del driver', () => {
  assert.equal(statusFrom('581.57', '581.80'), 'outdated');
  assert.equal(statusFrom('581.80', '581.80'), 'uptodate');
  assert.equal(statusFrom('582.00', '581.80'), 'newer');
  assert.equal(statusFrom(null, '581.80'), 'unknown');
});
