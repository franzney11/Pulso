'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { detectCpuOc, detectRamOc, assessOverclock, boardCapabilities } = require('../src/main/analysis/overclock');
const { lookupCpu } = require('../src/main/analysis/cpu-db');

const ryzen = () => ({ spec: lookupCpu('AMD Ryzen 5 5500'), reportedBaseMHz: 3600 }); // boost oficial 4200

test('CPU: dentro del boost oficial no es overclock', () => {
  const r = detectCpuOc(ryzen(), { peakCpuMHz: 4200, maxLoadPct: 90 });
  assert.equal(r.status, 'stock');
  assert.equal(r.confidence, 'high');
});

test('CPU: pasa del boost + 2,5 % → overclock', () => {
  const r = detectCpuOc(ryzen(), { peakCpuMHz: 4450, maxLoadPct: 90 });
  assert.equal(r.status, 'oc');
  assert.equal(r.deltaMHz, 250);
  assert.match(r.reasons[0], /por encima del boost/);
});

test('CPU: una oscilación pequeña (4,25 GHz) no dispara la alarma', () => {
  assert.equal(detectCpuOc(ryzen(), { peakCpuMHz: 4250, maxLoadPct: 90 }).status, 'stock');
});

test('CPU: sin carga la confianza es baja, y sin lecturas no se sabe', () => {
  assert.equal(detectCpuOc(ryzen(), { peakCpuMHz: 3000, maxLoadPct: 5 }).confidence, 'low');
  assert.equal(detectCpuOc(ryzen(), {}).status, 'unknown');
});

test('CPU: sin ficha no se inventa nada', () => {
  const r = detectCpuOc({ spec: null, reportedBaseMHz: 3000 }, { peakCpuMHz: 9000, maxLoadPct: 100 });
  assert.equal(r.status, 'unknown');
  assert.equal(r.specKnown, false);
});

test('RAM: por encima, igual o por debajo de la velocidad nominal', () => {
  const mod = (rated, configured) => ({ ratedMHz: rated, configuredMHz: configured });
  assert.equal(detectRamOc({ modules: [mod(2400, 3000), mod(2400, 3000)] }).overall, 'oc');
  assert.equal(detectRamOc({ modules: [mod(3200, 2133)] }).overall, 'below');
  assert.equal(detectRamOc({ modules: [mod(3200, 3200)] }).overall, 'stock');
  assert.equal(detectRamOc({ modules: [{ ratedMHz: null, configuredMHz: 3200 }] }).overall, 'unknown');
  assert.equal(detectRamOc({ modules: [] }).overall, 'unknown');
});

test('placas: qué chipsets permiten overclock de CPU', () => {
  assert.equal(boardCapabilities('B450').cpuOc, true);
  assert.equal(boardCapabilities('A520').cpuOc, false);
  assert.equal(boardCapabilities('Z790').cpuOc, true);
  assert.equal(boardCapabilities('B760').cpuOc, false);
  assert.equal(boardCapabilities('B760').ramOc, true);
  assert.equal(boardCapabilities('H610').ramOc, false);
  assert.equal(boardCapabilities('XYZ1').known, false);
  assert.equal(boardCapabilities(null).known, false);
});

// ---- Veredicto ----
const snap = (over = {}) => ({
  cpu: { name: 'AMD Ryzen 5 5500', vendor: 'AMD', spec: lookupCpu('AMD Ryzen 5 5500'), unlocked: true },
  board: { chipset: 'B450' },
  memory: { modules: [{ type: 'DDR4', ratedMHz: 2400, configuredMHz: 3000 }] },
  gpus: [{ name: 'NVIDIA GeForce RTX 5060' }],
  ...over,
});
const verdict = (s, extra = {}) => assessOverclock({ snapshot: s, ramOc: detectRamOc(s.memory), ...extra });

test('veredicto: CPU desbloqueada + placa B450 + torre + fuente holgada + frío → bueno', () => {
  const v = verdict(snap(), {
    profile: { coolerType: 'tower', cooler: 'Torre 120 mm', psuWatts: 650 },
    session: { maxCpuTempLoadedC: 60 },
  });
  assert.equal(v.level, 'good');
  assert.ok(v.score >= 75);
});

test('veredicto: faltan datos manuales → como mucho "limitado"', () => {
  const v = verdict(snap(), { profile: {}, session: {} });
  assert.equal(v.level, 'limited');
  assert.ok(v.factors.some((f) => f.id === 'cooling' && f.status === 'unknown'));
});

test('veredicto: multiplicador bloqueado manda sobre todo lo demás', () => {
  const s = snap({ cpu: { name: 'Intel Core i5-12400F', vendor: 'Intel', spec: lookupCpu('Intel Core i5-12400F'), unlocked: false }, board: { chipset: 'B660' } });
  const v = verdict(s, { profile: { coolerType: 'aio', psuWatts: 1000 }, session: { maxCpuTempLoadedC: 50 } });
  assert.equal(v.level, 'poor');
  assert.match(v.title, /no admite overclock/i);
  assert.equal(v.targets.find((t) => t.id === 'cpu').viable, false);
  assert.equal(v.targets.find((t) => t.id === 'ram').viable, true, 'la RAM sigue siendo ajustable en B660');
});

test('veredicto: disipador de caja y CPU caliente bajan el nivel', () => {
  const v = verdict(snap(), { profile: { coolerType: 'stock', psuWatts: 650 }, session: { maxCpuTempLoadedC: 88 } });
  assert.notEqual(v.level, 'good');
  assert.ok(v.factors.find((f) => f.id === 'temps').status === 'bad');
});

test('veredicto: fuente justa se marca', () => {
  const v = verdict(snap(), { profile: { coolerType: 'tower', psuWatts: 350 }, session: {} });
  assert.equal(v.factors.find((f) => f.id === 'psu').status, 'bad');
});

test('placa: los chipsets X870 y B450M (con sufijo de formato) se reconocen', () => {
  const { chipsetFromBoard } = require('../src/main/collectors/util');
  assert.equal(boardCapabilities(chipsetFromBoard('ROG STRIX X870-F GAMING WIFI')).cpuOc, true);
  assert.equal(boardCapabilities(chipsetFromBoard('B450M PRO-M2 MAX (MS-7B98)')).cpuOc, true);
});

test('Curve Optimizer solo se recomienda en Ryzen 5000, no en 3000', () => {
  const base = (name, arch) => ({
    snapshot: {
      cpu: { name, vendor: 'AMD', unlocked: true, spec: { arch, model: name, tdpW: 65 } },
      board: { chipset: 'B450' },
      memory: { modules: [{ type: 'DDR4', configuredMHz: 3000, ratedMHz: 2400 }] },
      gpus: [{}],
    },
    ramOc: { overall: 'stock' },
  });
  const cpuNote = (a) => assessOverclock(a).targets.find((t) => t.id === 'cpu').note;
  assert.match(cpuNote(base('AMD Ryzen 5 5500', 'Zen 3')), /Curve Optimizer/);
  assert.match(cpuNote(base('AMD Ryzen 5 3600', 'Zen 2')), /no hay Curve Optimizer/);
});
