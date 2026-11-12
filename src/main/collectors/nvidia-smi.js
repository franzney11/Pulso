'use strict';
// nvidia-smi viene con el driver de NVIDIA (no hay que instalar nada) y da temperatura,
// ventilador, relojes, potencia y VRAM de forma fiable y sin permisos de administrador.
const { execFile } = require('node:child_process');
const { num } = require('./util');

const FIELDS = [
  'name', 'driver_version', 'temperature.gpu', 'fan.speed', 'clocks.gr', 'clocks.max.gr',
  'clocks.mem', 'clocks.max.mem', 'power.draw', 'power.limit', 'power.default_limit',
  'power.max_limit', 'utilization.gpu', 'memory.total', 'memory.used',
];
const CANDIDATES = process.platform === 'win32'
  ? ['nvidia-smi', 'C:\\Windows\\System32\\nvidia-smi.exe', 'C:\\Program Files\\NVIDIA Corporation\\NVSMI\\nvidia-smi.exe']
  : ['nvidia-smi'];

let workingBin = null;
let missingUntil = 0; // si no existe, no volvemos a intentarlo durante un rato

function parseNvidiaSmi(csv) {
  return String(csv || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const v = line.split(',').map((s) => s.trim());
      const n = (i) => (/\[|N\/A|not supported/i.test(v[i] || '') ? null : num(v[i]));
      return {
        name: v[0],
        driverVersion: v[1] || null,
        tempC: n(2),
        fanPct: n(3),
        coreMHz: n(4),
        coreMaxMHz: n(5),
        memMHz: n(6),
        memMaxMHz: n(7),
        powerW: n(8),
        powerLimitW: n(9),
        powerDefaultW: n(10),
        powerMaxW: n(11),
        loadPct: n(12),
        vramTotalMB: n(13),
        vramUsedMB: n(14),
      };
    })
    .filter((g) => g.name);
}

function run(bin) {
  return new Promise((resolve, reject) => {
    execFile(
      bin,
      [`--query-gpu=${FIELDS.join(',')}`, '--format=csv,noheader,nounits'],
      { windowsHide: true, timeout: 4000, encoding: 'utf8' },
      (err, stdout) => (err ? reject(err) : resolve(stdout))
    );
  });
}

// Devuelve un array de GPUs NVIDIA o null si no hay nvidia-smi / no hay GPU NVIDIA.
async function query() {
  if (Date.now() < missingUntil) return null;
  const bins = workingBin ? [workingBin] : CANDIDATES;
  for (const bin of bins) {
    try {
      const out = parseNvidiaSmi(await run(bin));
      workingBin = bin;
      return out.length ? out : null;
    } catch { /* probamos el siguiente */ }
  }
  workingBin = null;
  missingUntil = Date.now() + 60000;
  return null;
}

module.exports = { query, parseNvidiaSmi };
