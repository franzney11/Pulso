'use strict';
// Compara los drivers instalados con los más recientes. Solo NVIDIA se consulta de forma
// automática; AMD, Intel, chipset y BIOS no tienen API pública, así que se muestra lo
// instalado y un enlace directo a la página oficial ("manual"). Se prefiere ser honestos
// con eso antes que enseñar una versión "más reciente" inventada o rascada de una web frágil.
const { compareVersions } = require('./versions');
const nvidia = require('./nvidia');

const LINKS = {
  nvidia: 'https://www.nvidia.com/en-us/geforce/drivers/',
  amdGpu: 'https://www.amd.com/en/support/download/drivers.html',
  intelGpu: 'https://www.intel.com/content/www/us/en/download-center/home.html',
  amdChipset: 'https://www.amd.com/en/support/download/drivers.html',
  intelChipset: 'https://www.intel.com/content/www/us/en/download-center/home.html',
};
const search = (q) => `https://www.google.com/search?q=${encodeURIComponent(q)}`;

function statusFrom(installed, latest) {
  const c = compareVersions(installed, latest);
  if (c === null) return 'unknown';
  return c < 0 ? 'outdated' : c === 0 ? 'uptodate' : 'newer';
}

async function checkDrivers({ snapshot, demo = false }) {
  const rows = [];

  for (const [i, g] of snapshot.gpus.entries()) {
    const base = { id: `gpu-${i}`, component: 'Gráfica', name: g.name, installed: g.driverVersion, installedDate: g.driverDate };
    if (g.vendor === 'NVIDIA') {
      const res = demo
        ? { ok: true, version: '581.80', releaseDate: '2026-10-14', downloadUrl: LINKS.nvidia, approximate: false, matchedModel: 'GeForce RTX 5060' }
        : await nvidia.fetchLatest({ gpuName: g.name, osBuild: snapshot.os.build });
      if (res.ok) {
        rows.push({
          ...base, latest: res.version, latestDate: res.releaseDate, status: statusFrom(g.driverVersion, res.version),
          url: LINKS.nvidia, source: 'nvidia.com',
          note: res.approximate ? `Versión de la serie (consultada con ${res.matchedModel}): el driver GeForce es el mismo para toda la serie.` : null,
        });
      } else {
        rows.push({ ...base, latest: null, status: 'unavailable', url: LINKS.nvidia, source: 'nvidia.com', note: res.reason });
      }
    } else {
      rows.push({
        ...base, latest: null, status: 'manual', source: g.vendor,
        url: g.vendor === 'AMD' ? LINKS.amdGpu : g.vendor === 'Intel' ? LINKS.intelGpu : search(`${g.name} driver`),
        note: `${g.vendor || 'Este fabricante'} no ofrece una forma automática de consultar la última versión.`,
      });
    }
  }

  const cpu = snapshot.cpu;
  const chipsetSw = cpu.chipsetDriver;
  rows.push({
    id: 'chipset', component: 'Chipset', name: chipsetSw ? chipsetSw.name : `Chipset ${snapshot.board.chipset || ''}`.trim(),
    installed: chipsetSw ? chipsetSw.version : null, latest: null, status: 'manual',
    url: cpu.vendor === 'Intel' ? LINKS.intelChipset : LINKS.amdChipset, source: cpu.vendor,
    note: chipsetSw
      ? 'Las CPU no tienen driver propio: lo que se actualiza es el driver del chipset. Compara esta versión con la de la web.'
      : 'No se encontró el driver de chipset instalado. Las CPU no tienen driver propio: se actualiza el del chipset.',
  });

  const b = snapshot.board;
  rows.push({
    id: 'bios', component: 'BIOS', name: `${b.manufacturer} ${b.model}`.trim(),
    installed: b.bios.version ? `${b.bios.version}${b.bios.date ? ` (${b.bios.date})` : ''}` : null, latest: null, status: 'manual',
    url: search(`${b.manufacturer} ${b.model} BIOS download`), source: b.manufacturer,
    note: 'Cada fabricante publica la BIOS en su web. Actualízala solo si la nueva versión corrige algo que te afecta.',
  });

  return rows;
}

module.exports = { checkDrivers, statusFrom };
