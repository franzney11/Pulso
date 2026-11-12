'use strict';
// Normalización de lo que devuelve PowerShell (sin necesitar Windows): usamos datos de ejemplo
// con la misma forma que Get-CimInstance → ConvertTo-Json.
const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeWindows, parseCpuLive } = require('../src/main/collectors/windows');

const RAW = {
  cpu: [{ Name: 'AMD Ryzen 5 5500 6-Core Processor', Manufacturer: 'AuthenticAMD', NumberOfCores: 6, NumberOfLogicalProcessors: 12, MaxClockSpeed: 3600, L2CacheSize: 3072, L3CacheSize: 16384, SocketDesignation: 'AM4' }],
  gpu: [
    { Name: 'NVIDIA GeForce RTX 5060', AdapterCompatibility: 'NVIDIA', AdapterRAM: 4293918720, DriverVersion: '32.0.15.8157', DriverDate: '2026-09-02' },
    { Name: 'Microsoft Basic Display Adapter', AdapterCompatibility: 'Microsoft', AdapterRAM: 0, DriverVersion: '10.0.1' },
  ],
  gpuMem: [{ DriverDesc: 'NVIDIA GeForce RTX 5060', Mem: 8548999168 }],
  // PowerShell devuelve un objeto suelto (no un array) cuando solo hay un elemento
  ram: { DeviceLocator: 'DIMM_A2', Manufacturer: '029E', PartNumber: 'CMK16GX4M2A2400C16 ', Capacity: '8589934592', Speed: 2400, ConfiguredClockSpeed: 3000, ConfiguredVoltage: 1350, SMBIOSMemoryType: 26 },
  ramSlots: [{ MemoryDevices: 4 }],
  board: [{ Manufacturer: 'Micro-Star International Co., Ltd.', Product: 'B450M PRO-M2 MAX (MS-7B98)', Version: '1.0' }],
  bios: [{ Manufacturer: 'American Megatrends', SMBIOSBIOSVersion: 'A.D0', ReleaseDate: '2024-03-14' }],
  os: [{ Caption: 'Microsoft Windows 11 Home', Version: '10.0.26100', BuildNumber: '26100', OSArchitecture: '64-bit' }],
  machine: [{ Name: 'MI-PC', Manufacturer: 'System manufacturer', Model: 'System Product Name' }],
  disks: [
    { Id: '0', Name: 'WD Blue SN570', MediaType: 'SSD', BusType: 'NVMe', Size: 1000204886016, Health: 'Healthy', Operational: 'OK', Wear: 6, Temp: 41, Hours: 2140, ReadErr: 0, WriteErr: 0, ReadUnc: 0, WriteUnc: 0 },
    { Id: '1', Name: 'ST1000DM010', MediaType: 'HDD', BusType: 'SATA', Size: 1000204886016, Health: 'Healthy', Operational: 'OK', Wear: null, Temp: 37, Hours: 31200, ReadUnc: 3, WriteUnc: 0 },
  ],
  software: [{ DisplayName: 'AMD Chipset Software', DisplayVersion: '6.07.22.222' }],
};

test('normaliza la CPU, la placa y el SO', () => {
  const s = normalizeWindows(RAW);
  assert.equal(s.cpu.name, 'AMD Ryzen 5 5500');
  assert.equal(s.cpu.vendor, 'AMD');
  assert.equal(s.cpu.threads, 12);
  assert.equal(s.cpu.reportedBaseMHz, 3600);
  assert.deepEqual(s.cpu.chipsetDriver, { name: 'AMD Chipset Software', version: '6.07.22.222' });
  assert.equal(s.board.manufacturer, 'MSI');
  assert.equal(s.board.chipset, 'B450');
  assert.equal(s.os.build, '26100');
});

test('GPU: ignora el adaptador básico, corrige la VRAM y la versión del driver', () => {
  const s = normalizeWindows(RAW);
  assert.equal(s.gpus.length, 1);
  assert.equal(s.gpus[0].driverVersion, '581.57');
  assert.equal(s.gpus[0].vramMB, 8153, 'AdapterRAM se queda en 4 GB; se usa el valor del registro');
});

test('RAM: acepta un único objeto y lee nominal frente a configurada', () => {
  const s = normalizeWindows(RAW);
  assert.equal(s.memory.modules.length, 1);
  const m = s.memory.modules[0];
  assert.equal(m.type, 'DDR4');
  assert.equal(m.manufacturer, 'Corsair');
  assert.equal(m.partNumber, 'CMK16GX4M2A2400C16');
  assert.equal(m.capacityMB, 8192);
  assert.equal(m.ratedMHz, 2400);
  assert.equal(m.configuredMHz, 3000);
  assert.equal(m.voltageV, 1.35);
  assert.equal(s.memory.slotsTotal, 4);
});

test('discos: tipo, desgaste y errores', () => {
  const s = normalizeWindows(RAW);
  assert.equal(s.disks[0].type, 'NVMe');
  assert.equal(s.disks[0].smart.wearPct, 6);
  assert.equal(s.disks[1].type, 'HDD');
  assert.equal(s.disks[1].smart.uncorrectedErrors, 3);
  assert.equal(s.disks[1].smart.wearPct, null);
});

test('sin ningún dato no revienta', () => {
  const s = normalizeWindows({});
  assert.equal(s.cpu.name, '');
  assert.deepEqual(s.gpus, []);
  assert.deepEqual(s.disks, []);
});

test('lecturas en vivo: frecuencia efectiva = nominal × % de rendimiento', () => {
  const live = parseCpuLive({
    t: [
      { Name: '0,0', ProcessorFrequency: 3593, PercentProcessorPerformance: 117, PercentProcessorUtility: 80 },
      { Name: '0,1', ProcessorFrequency: 3593, PercentProcessorPerformance: 100, PercentProcessorUtility: 20 },
      { Name: '0,_Total', ProcessorFrequency: 3593, PercentProcessorPerformance: 108 },
      { Name: '_Total', ProcessorFrequency: 3593, PercentProcessorPerformance: 108, PercentProcessorUtility: 50 },
    ],
  });
  assert.equal(live.perCore.length, 2, 'solo hilos reales, no los totales');
  assert.equal(live.maxCoreMHz, 4204);
  assert.equal(live.effectiveMHz, 3880);
  assert.equal(live.nominalMHz, 3593);
  assert.equal(live.loadPct, 50);
  assert.equal(parseCpuLive({ t: [] }), null);
});
