'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { diskHealth } = require('../src/main/analysis/health');

const disk = (type, smart) => ({ type, smart: { status: 'Healthy', wearPct: null, tempC: null, powerOnHours: null, uncorrectedErrors: null, ...smart } });

test('SSD: la vida útil sale del desgaste', () => {
  const h = diskHealth(disk('NVMe', { wearPct: 6 }));
  assert.equal(h.score, 94);
  assert.equal(h.status, 'ok');
  assert.equal(diskHealth(disk('SSD', { wearPct: 80 })).status, 'warn');
  assert.equal(diskHealth(disk('SSD', { wearPct: 95 })).status, 'bad');
});

test('HDD: no inventa un porcentaje', () => {
  const h = diskHealth(disk('HDD', {}));
  assert.equal(h.score, null);
  assert.equal(h.status, 'ok');
});

test('errores sin corregir y estado de Windows pesan más que el desgaste', () => {
  assert.equal(diskHealth(disk('HDD', { uncorrectedErrors: 3 })).status, 'warn');
  assert.equal(diskHealth(disk('HDD', { uncorrectedErrors: 80 })).status, 'bad');
  assert.equal(diskHealth(disk('SSD', { status: 'Unhealthy', wearPct: 2 })).status, 'bad');
  assert.equal(diskHealth(disk('SSD', { status: 'Warning', wearPct: 2 })).status, 'warn');
});

test('sin datos SMART dice "Sin datos"', () => {
  const h = diskHealth({ type: 'Disco', smart: { status: null } });
  assert.equal(h.status, 'unknown');
  assert.equal(h.label, 'Sin datos');
});

test('un HDD de más de 5 años pasa a "Revisar"', () => {
  assert.equal(diskHealth(disk('HDD', { powerOnHours: 50000 })).status, 'warn');
  assert.equal(diskHealth(disk('HDD', { powerOnHours: 10000 })).status, 'ok');
});
