'use strict';
// De punta a punta, con el modo demo: recolecta → analiza → informe.
const test = require('node:test');
const assert = require('node:assert/strict');
const { collectSnapshot } = require('../src/main/collectors');
const demo = require('../src/main/collectors/demo');
const { buildReport } = require('../src/main/analysis/report');
const { checkDrivers } = require('../src/main/drivers');
const { cpuTempFrom } = require('../src/main/analysis/sensors');

test('el snapshot demo trae la ficha de la CPU', async () => {
  const s = await collectSnapshot({ demo: true });
  assert.equal(s.cpu.spec.model, 'Ryzen 5 5500');
  assert.equal(s.cpu.unlocked, true);
  assert.equal(s.board.chipset, 'B450');
});

test('informe: CPU de fábrica con el boost normal, RAM overclockeada', async () => {
  const snapshot = await collectSnapshot({ demo: true });
  const live = demo.liveAt(30);
  const report = buildReport({ snapshot, live, profile: { coolerType: 'stock', psuWatts: 650 }, session: { peakCpuMHz: 4200, maxLoadPct: 90 } });
  assert.equal(report.summary.cpuOc, 'stock');
  assert.equal(report.summary.ramOc, 'oc');
  assert.equal(report.disks.length, 3);
  assert.equal(report.disks[0].score, 94);
  assert.ok(['good', 'limited', 'poor'].includes(report.summary.level));
});

test('informe: la demo con overclock se detecta como overclock', async () => {
  const snapshot = await collectSnapshot({ demo: true });
  const t0 = Array.from({ length: 200 }, (_, i) => demo.liveAt(i, { oc: true }));
  const peak = Math.max(...t0.map((l) => l.cpu.maxCoreMHz));
  const report = buildReport({ snapshot, live: t0[0], session: { peakCpuMHz: peak, maxLoadPct: 95 } });
  assert.equal(report.summary.cpuOc, 'oc');
  assert.ok(report.cpuOc.deltaMHz > 100);
});

test('la demo en modo normal nunca supera el boost de fábrica', () => {
  const peak = Math.max(...Array.from({ length: 400 }, (_, i) => demo.liveAt(i).cpu.maxCoreMHz));
  assert.ok(peak <= 4200);
});

test('drivers: la demo marca la gráfica como desactualizada y el chipset como manual', async () => {
  const snapshot = await collectSnapshot({ demo: true });
  const rows = await checkDrivers({ snapshot, demo: true });
  assert.equal(rows.find((r) => r.id === 'gpu-0').status, 'outdated');
  assert.equal(rows.find((r) => r.id === 'chipset').status, 'manual');
  assert.equal(rows.find((r) => r.id === 'chipset').installed, '6.07.22.222');
  assert.equal(rows.find((r) => r.id === 'bios').status, 'manual');
});

test('temperatura de la CPU a partir de los sensores', () => {
  assert.ok(cpuTempFrom(demo.liveAt(10).sensors) > 30);
  assert.equal(cpuTempFrom({ available: false, items: [] }), null);
});
