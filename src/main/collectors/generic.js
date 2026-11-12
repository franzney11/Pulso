'use strict';
// Recolector genérico (Linux/macOS, o Windows si PowerShell falla) con la librería systeminformation.
// Sirve sobre todo para desarrollar fuera de Windows: Pulso está pensado para Windows.
const si = require('systeminformation');
const { clean, num, cleanCpuName, chipsetFromBoard, shortBoardVendor } = require('./util');

const safe = (p) => Promise.resolve(p).catch(() => null);

async function collect() {
  const [cpu, gfx, memLayout, board, bios, disks, os, sys] = await Promise.all([
    safe(si.cpu()), safe(si.graphics()), safe(si.memLayout()), safe(si.baseboard()),
    safe(si.bios()), safe(si.diskLayout()), safe(si.osInfo()), safe(si.system()),
  ]);
  const c = cpu || {};
  const rawName = clean(`${c.manufacturer || ''} ${c.brand || ''}`);

  const modules = (memLayout || []).filter((m) => m.size).map((m) => ({
    slot: clean(m.bank) || clean(m.formFactor),
    manufacturer: clean(m.manufacturer),
    partNumber: clean(m.partNum),
    capacityMB: Math.round(m.size / 1048576),
    type: clean(m.type) || null,
    ratedMHz: num(m.clockSpeed),
    configuredMHz: num(m.clockSpeed),
    voltageV: num(m.voltageConfigured),
  }));

  return {
    meta: { source: process.platform, collectedAt: Date.now(), warnings: [] },
    machine: { name: (os && os.hostname) || '', manufacturer: clean(sys && sys.manufacturer), model: clean(sys && sys.model) },
    os: { caption: clean(os && `${os.distro} ${os.release}`), version: clean(os && os.kernel), build: '', arch: clean(os && os.arch) },
    cpu: {
      vendor: /intel/i.test(rawName) ? 'Intel' : /amd/i.test(rawName) ? 'AMD' : clean(c.manufacturer),
      rawName,
      name: cleanCpuName(rawName),
      cores: num(c.physicalCores),
      threads: num(c.cores),
      reportedBaseMHz: c.speed ? Math.round(c.speed * 1000) : null,
      l2KB: c.cache && c.cache.l2 ? Math.round(c.cache.l2 / 1024) : null,
      l3KB: c.cache && c.cache.l3 ? Math.round(c.cache.l3 / 1024) : null,
      socket: clean(c.socket) || null,
      sockets: 1,
      chipsetDriver: null,
    },
    gpus: ((gfx && gfx.controllers) || []).map((g) => ({
      name: clean(g.model),
      vendor: /nvidia/i.test(g.vendor) ? 'NVIDIA' : /amd|advanced micro/i.test(g.vendor) ? 'AMD' : /intel/i.test(g.vendor) ? 'Intel' : clean(g.vendor),
      vramMB: num(g.vram),
      vramApprox: false,
      driverVersionRaw: clean(g.driverVersion),
      driverVersion: clean(g.driverVersion) || null,
      driverDate: null,
    })),
    memory: {
      totalMB: modules.reduce((s, m) => s + m.capacityMB, 0),
      slotsTotal: (memLayout || []).length || null,
      modules,
    },
    board: {
      manufacturer: shortBoardVendor(board && board.manufacturer),
      model: clean(board && board.model),
      version: clean(board && board.version),
      chipset: chipsetFromBoard(board && board.model),
      bios: { vendor: clean(bios && bios.vendor), version: clean(bios && bios.version), date: clean(bios && bios.releaseDate) || null },
    },
    disks: (disks || []).map((d, i) => ({
      id: String(i),
      name: clean(d.name),
      type: /nvme/i.test(d.interfaceType + d.type) ? 'NVMe' : /ssd/i.test(d.type) ? 'SSD' : /hd/i.test(d.type) ? 'HDD' : 'Disco',
      bus: clean(d.interfaceType),
      sizeGB: Math.round((d.size || 0) / 1e9),
      smart: {
        status: /ok/i.test(d.smartStatus || '') ? 'Healthy' : d.smartStatus && d.smartStatus !== 'unknown' ? 'Warning' : null,
        operational: null, wearPct: null, tempC: null, powerOnHours: null,
        readErrors: null, writeErrors: null, uncorrectedErrors: null,
      },
    })),
    software: [],
  };
}

// Muestras en vivo cada segundo; devuelve { stop }.
function streamCpu(onCpu) {
  let stopped = false;
  const tick = async () => {
    try {
      const [speed, load] = await Promise.all([si.cpuCurrentSpeed(), si.currentLoad()]);
      const cores = (speed.cores || []).map((ghz, i) => ({
        id: String(i), mhz: Math.round(ghz * 1000),
        loadPct: load.cpus && load.cpus[i] ? Math.round(load.cpus[i].load) : 0,
      }));
      const mhz = cores.map((c) => c.mhz).filter(Boolean);
      onCpu({
        effectiveMHz: speed.avg ? Math.round(speed.avg * 1000) : null,
        maxCoreMHz: mhz.length ? Math.max(...mhz) : null,
        nominalMHz: null,
        loadPct: Math.round(load.currentLoad || 0),
        perCore: cores,
      });
    } catch { /* se reintenta en el siguiente tick */ }
  };
  tick();
  const timer = setInterval(() => !stopped && tick(), 1000);
  return { stop: () => { stopped = true; clearInterval(timer); } };
}

module.exports = { collect, streamCpu };
