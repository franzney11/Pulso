'use strict';
// Junta todo el análisis en un único informe que consume la interfaz.
const { detectCpuOc, detectRamOc, assessOverclock } = require('./overclock');
const { diskHealth } = require('./health');

function analyzeGpus(snapshot, live) {
  return snapshot.gpus.map((g, i) => {
    const l = live && live.gpus && (live.gpus.find((x) => x.name === g.name) || live.gpus[i]);
    return {
      name: g.name,
      powerLimitRaised: !!(l && l.powerLimitW && l.powerDefaultW && l.powerLimitW > l.powerDefaultW),
      powerHeadroomW: l && l.powerMaxW && l.powerLimitW ? Math.max(0, l.powerMaxW - l.powerLimitW) : null,
    };
  });
}

function buildReport({ snapshot, live = null, profile = {}, session = {}, drivers = [] }) {
  const cpuOc = detectCpuOc(snapshot.cpu, session);
  const ramOc = detectRamOc(snapshot.memory);
  const disks = snapshot.disks.map((d) => ({ id: d.id, ...diskHealth(d) }));
  const overclock = assessOverclock({ snapshot, profile, live, session, ramOc });

  const worstDisk = ['bad', 'warn', 'unknown', 'ok'].find((s) => disks.some((d) => d.status === s)) || 'unknown';
  const outdated = drivers.filter((d) => d.status === 'outdated').length;

  return {
    cpuOc, ramOc, gpus: analyzeGpus(snapshot, live), disks, drivers, overclock,
    summary: { cpuOc: cpuOc.status, ramOc: ramOc.overall, worstDisk, outdatedDrivers: outdated, level: overclock.level },
  };
}

module.exports = { buildReport };
