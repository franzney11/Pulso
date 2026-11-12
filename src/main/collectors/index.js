'use strict';
// Punto de entrada de los recolectores: escoge el de Windows, el genérico o el demo.
const windows = require('./windows');
const generic = require('./generic');
const demo = require('./demo');
const nvidiaSmi = require('./nvidia-smi');
const lhm = require('./lhm');
const { lookupCpu, inferUnlocked } = require('../analysis/cpu-db');

const DEFAULT_LHM_URL = 'http://localhost:8085/data.json';

async function collectSnapshot({ demo: isDemo = false } = {}) {
  let snap;
  if (isDemo) {
    snap = demo.snapshot();
  } else if (process.platform === 'win32') {
    try {
      snap = await windows.collect();
    } catch (e) {
      snap = await generic.collect();
      snap.meta.warnings.push(`PowerShell falló (${e.message}). Se usó el recolector genérico, con menos datos.`);
    }
  } else {
    snap = await generic.collect();
  }

  // Ficha oficial de la CPU (frecuencias de fábrica, TDP, multiplicador desbloqueado…).
  snap.cpu.spec = lookupCpu(snap.cpu.rawName || snap.cpu.name);
  snap.cpu.unlocked = snap.cpu.spec ? snap.cpu.spec.unlocked : inferUnlocked(snap.cpu.rawName || snap.cpu.name, snap.cpu.vendor);

  // nvidia-smi corrige la VRAM (Windows la capa a 4 GB en algunas rutas).
  if (!isDemo) {
    const nv = await nvidiaSmi.query();
    if (nv) {
      for (const g of nv) {
        const match = snap.gpus.find((x) => x.name.toLowerCase() === g.name.toLowerCase());
        if (match && g.vramTotalMB) { match.vramMB = g.vramTotalMB; match.vramApprox = false; }
      }
    }
  }
  return snap;
}

// Arranca las lecturas en vivo y llama a onTick cada segundo con todo junto.
function startLive({ demo: isDemo = false, demoOc = false, getProfile = () => ({}), onTick }) {
  if (isDemo) return demo.start({ oc: demoOc }, onTick);

  const latest = { cpu: null, gpus: null, sensors: { available: false, source: 'lhm', items: [] } };
  const timers = [];
  let cpuStream = null;
  let stopped = false;

  const startCpu = (forceGeneric) => {
    const useWin = process.platform === 'win32' && !forceGeneric;
    const src = useWin ? windows : generic;
    cpuStream = src.streamCpu(
      (c) => { latest.cpu = c; },
      () => { if (!stopped && useWin) startCpu(true); } // PowerShell se cayó: seguimos con el genérico
    );
  };
  startCpu(false);

  const pollGpu = async () => { latest.gpus = await nvidiaSmi.query(); };
  const pollSensors = async () => {
    const url = (getProfile() && getProfile().lhmUrl) || DEFAULT_LHM_URL;
    latest.sensors = await lhm.fetchSensors(url);
  };
  pollGpu();
  pollSensors();
  timers.push(
    setInterval(pollGpu, 2000),
    setInterval(pollSensors, 2500),
    setInterval(() => onTick({ ts: Date.now(), cpu: latest.cpu, gpus: latest.gpus, sensors: latest.sensors }), 1000)
  );

  return {
    stop() {
      stopped = true;
      timers.forEach(clearInterval);
      if (cpuStream) cpuStream.stop();
    },
  };
}

module.exports = { collectSnapshot, startLive, DEFAULT_LHM_URL };
