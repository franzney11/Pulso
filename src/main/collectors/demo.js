'use strict';
// Datos de ejemplo (modo demo): `npm run start:demo`.
// Todo es ficticio salvo la configuración base, que imita el PC de Franz (Ryzen 5 5500,
// B450M, RTX 5060, 2x8 GB) para que veas cómo se vería tu pantalla. Los valores en vivo se
// generan con ondas senoidales, no se leen de ningún sensor.
const { clamp } = require('./util');

function snapshot() {
  return {
    meta: { source: 'demo', collectedAt: Date.now(), warnings: [] },
    machine: { name: 'PC-DEMO', manufacturer: 'Montado a mano', model: '' },
    os: { caption: 'Windows 11 Home', version: '10.0.26100', build: '26100', arch: '64-bit' },
    cpu: {
      vendor: 'AMD', rawName: 'AMD Ryzen 5 5500 6-Core Processor', name: 'AMD Ryzen 5 5500',
      cores: 6, threads: 12, reportedBaseMHz: 3600, l2KB: 3072, l3KB: 16384, socket: 'AM4', sockets: 1,
      chipsetDriver: { name: 'AMD Chipset Software', version: '6.07.22.222' },
    },
    gpus: [{
      name: 'NVIDIA GeForce RTX 5060', vendor: 'NVIDIA', vramMB: 8151, vramApprox: false,
      driverVersionRaw: '32.0.15.8157', driverVersion: '581.57', driverDate: '2026-09-02',
    }],
    memory: {
      totalMB: 16384, slotsTotal: 4,
      modules: [
        { slot: 'DIMM_A2', manufacturer: 'Corsair', partNumber: 'CMK16GX4M2A2400C16', capacityMB: 8192, type: 'DDR4', ratedMHz: 2400, configuredMHz: 3000, voltageV: 1.35 },
        { slot: 'DIMM_B2', manufacturer: 'Corsair', partNumber: 'CMK16GX4M2A2400C16', capacityMB: 8192, type: 'DDR4', ratedMHz: 2400, configuredMHz: 3000, voltageV: 1.35 },
      ],
    },
    board: {
      manufacturer: 'MSI', model: 'B450M PRO-M2 MAX (MS-7B98)', version: '1.0', chipset: 'B450',
      bios: { vendor: 'American Megatrends International, LLC.', version: 'A.D0', date: '2024-03-14' },
    },
    disks: [
      { id: '0', name: 'NVMe SSD 1TB (ejemplo)', type: 'NVMe', bus: 'NVMe', sizeGB: 1000,
        smart: { status: 'Healthy', operational: 'OK', wearPct: 6, tempC: 41, powerOnHours: 2140, readErrors: 0, writeErrors: 0, uncorrectedErrors: 0 } },
      { id: '1', name: 'SATA SSD 480GB (ejemplo)', type: 'SSD', bus: 'SATA', sizeGB: 480,
        smart: { status: 'Healthy', operational: 'OK', wearPct: 38, tempC: 34, powerOnHours: 15890, readErrors: 0, writeErrors: 0, uncorrectedErrors: 0 } },
      { id: '2', name: 'HDD 1TB 7200 rpm (ejemplo)', type: 'HDD', bus: 'SATA', sizeGB: 1000,
        smart: { status: 'Healthy', operational: 'OK', wearPct: null, tempC: 37, powerOnHours: 31200, readErrors: 14, writeErrors: 0, uncorrectedErrors: 3 } },
    ],
    software: [{ name: 'AMD Chipset Software', version: '6.07.22.222' }],
  };
}

// Un instante de datos en vivo. `t` en segundos.
function liveAt(t, { oc = false } = {}) {
  const wave = 0.5 + 0.5 * Math.sin(t / 6.5);
  const load = Math.round(6 + 90 * Math.pow(wave, 1.8));
  const boost = oc ? 4550 : 4200;
  const perCore = Array.from({ length: 12 }, (_, i) => {
    const jitter = Math.sin(t * 1.7 + i * 2.1) * 0.5 + 0.5;
    const coreLoad = clamp(Math.round(load * (0.55 + jitter * 0.6)), 1, 100);
    const mhz = Math.round(2150 + (boost - 2150) * Math.pow(coreLoad / 100, 0.45) + Math.sin(t * 3 + i) * 35);
    return { id: `0,${i}`, mhz: Math.min(mhz, boost), loadPct: coreLoad };
  });
  const mhzList = perCore.map((c) => c.mhz);
  const avg = Math.round(mhzList.reduce((a, b) => a + b, 0) / mhzList.length);

  const gWave = 0.5 + 0.5 * Math.sin(t / 9 + 1.3);
  const gLoad = Math.round(4 + 92 * Math.pow(gWave, 1.4));
  const cpuTemp = 36 + load * 0.38 + Math.sin(t) * 0.6;
  const s = (hw, hwType, group, name, value, unit) => ({ hw, hwType, group, name, value: +value.toFixed(unit === 'V' ? 3 : 1), unit });
  const chip = 'Nuvoton NCT6797D';
  return {
    ts: Date.now(),
    cpu: { effectiveMHz: avg, maxCoreMHz: Math.max(...mhzList), nominalMHz: 3593, loadPct: load, perCore },
    gpus: [{
      name: 'NVIDIA GeForce RTX 5060', driverVersion: '581.57',
      tempC: Math.round(37 + gLoad * 0.32), fanPct: gLoad < 25 ? 0 : Math.round(30 + gLoad * 0.45),
      coreMHz: Math.round(210 + (2760 - 210) * Math.pow(gLoad / 100, 0.6)), coreMaxMHz: 3105,
      memMHz: 14001, memMaxMHz: 14001,
      powerW: Math.round(14 + gLoad * 1.15), powerLimitW: 145, powerDefaultW: 145, powerMaxW: 145,
      loadPct: gLoad, vramTotalMB: 8151, vramUsedMB: Math.round(900 + gLoad * 38),
    }],
    sensors: {
      available: true, source: 'demo',
      items: [
        s('AMD Ryzen 5 5500', 'cpu', 'temps', 'Core (Tctl/Tdie)', cpuTemp, '°C'),
        s('AMD Ryzen 5 5500', 'cpu', 'voltages', 'Core (SVI2 TFN)', 0.95 + load * 0.0036, 'V'),
        s('AMD Ryzen 5 5500', 'cpu', 'powers', 'Package', 17 + load * 0.62, 'W'),
        s(chip, 'superio', 'fans', 'CPU Fan', 760 + load * 13, 'RPM'),
        s(chip, 'superio', 'fans', 'Case Fan #1 (frontal)', 820 + Math.sin(t / 4) * 15, 'RPM'),
        s(chip, 'superio', 'fans', 'Case Fan #2 (trasero)', 790 + Math.cos(t / 5) * 15, 'RPM'),
        s(chip, 'superio', 'voltages', '+12V', 12.05 - load * 0.0012, 'V'),
        s(chip, 'superio', 'voltages', '+5V', 5.02, 'V'),
        s(chip, 'superio', 'voltages', '+3.3V', 3.31, 'V'),
        s(chip, 'superio', 'temps', 'Placa base', 33 + load * 0.08, '°C'),
      ],
    },
  };
}

function start({ oc = false } = {}, onTick) {
  const t0 = Date.now();
  const emit = () => onTick(liveAt((Date.now() - t0) / 1000 + 4, { oc }));
  emit();
  const timer = setInterval(emit, 1000);
  return { stop: () => clearInterval(timer) };
}

module.exports = { snapshot, liveAt, start };
