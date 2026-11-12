'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { parseNvidiaSmi } = require('../src/main/collectors/nvidia-smi');
const { findPfid, normalizeGpuName } = require('../src/main/drivers/nvidia');

test('nvidia-smi: parsea una línea CSV', () => {
  const [g] = parseNvidiaSmi('NVIDIA GeForce RTX 5060, 581.57, 54, 41, 1952, 3105, 14001, 14001, 75.2, 145.00, 145.00, 145.00, 53, 8151, 2800\n');
  assert.equal(g.name, 'NVIDIA GeForce RTX 5060');
  assert.equal(g.driverVersion, '581.57');
  assert.equal(g.tempC, 54);
  assert.equal(g.coreMHz, 1952);
  assert.equal(g.powerLimitW, 145);
  assert.equal(g.vramTotalMB, 8151);
});

test('nvidia-smi: [N/A] y [Not Supported] son null, no 0', () => {
  const [g] = parseNvidiaSmi('NVIDIA GeForce GTX 1050, 560.94, 40, [N/A], 1200, 1900, 3504, 3504, [Not Supported], 75, 75, 75, 10, 2048, 300');
  assert.equal(g.fanPct, null);
  assert.equal(g.powerW, null);
  assert.equal(g.tempC, 40);
});

test('nvidia-smi: salida vacía', () => {
  assert.deepEqual(parseNvidiaSmi(''), []);
  assert.deepEqual(parseNvidiaSmi(null), []);
});

test('tabla de IDs de NVIDIA: modelo exacto y por serie', () => {
  assert.equal(normalizeGpuName('NVIDIA GeForce RTX 4060'), 'GeForce RTX 4060');
  const exact = findPfid('NVIDIA GeForce RTX 4060');
  assert.equal(exact.exact, true);
  assert.equal(exact.pfid, '1023');
  const series = findPfid('NVIDIA GeForce RTX 5060'); // el 5060 a secas no está: usa la misma serie
  assert.ok(series);
  assert.equal(series.exact, false);
  assert.match(series.matched, /RTX 50\d{2}/);
  assert.equal(findPfid('NVIDIA GeForce RTX 4060 Laptop GPU'), null, 'los portátiles no están en la tabla');
  assert.equal(findPfid('Intel(R) UHD Graphics'), null);
});
