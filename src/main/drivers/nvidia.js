'use strict';
// Consulta la última versión del driver GeForce Game Ready.
//
// Cómo funciona (mismo mecanismo que usan los proyectos nvidia-update de GitHub):
//   GET gfwsl.geforce.com/.../AjaxDriverService.php?func=DriverManualLookup&pfid=<id de GPU>&osID=<id de Windows>&dch=1
//   → { Success: 1, IDS: [ { downloadInfo: { Version, DownloadURL, ReleaseDateTime } } ] }
// El `pfid` es el ID de producto de NVIDIA. Se saca de una tabla (incluida en data/ y refrescada
// desde GitHub). Si tu modelo aún no está en la tabla, se usa el modelo más nuevo de la misma
// serie: el driver GeForce es unificado, así que la versión más reciente es la misma.
//
// Esta API no es oficial ni está documentada, y NVIDIA puede cambiarla sin avisar. Por eso
// el resultado siempre trae `ok:false` + motivo en vez de romper, y la UI enlaza a nvidia.com.
const bundled = require('../data/nvidia-gpu-ids.json').desktop;

const GPU_DATA_URL = 'https://raw.githubusercontent.com/ZenitH-AT/nvidia-data/main/gpu-data.json';
const LOOKUP_URL = 'https://gfwsl.geforce.com/services_toolkit/services/com/nvidia/services/AjaxDriverService.php';
const OS_ID = { win10: 57, win11: 135 };

function normalizeGpuName(name) {
  return String(name || '').replace(/^NVIDIA\s+/i, '').replace(/\s+/g, ' ').trim();
}

// Devuelve { pfid, exact, matched } o null.
function findPfid(gpuName, table = bundled) {
  const n = normalizeGpuName(gpuName);
  if (/laptop|max-q|notebook/i.test(n)) return null; // la tabla incluida es solo de sobremesa
  if (table[n]) return { pfid: table[n], exact: true, matched: n };
  const m = /(RTX|GTX)\s?(\d{2})\d{2}/i.exec(n);
  if (!m) return null;
  const re = new RegExp(`^GeForce ${m[1].toUpperCase()} ${m[2]}\\d{2}`);
  const sameSeries = Object.keys(table).filter((k) => re.test(k));
  if (!sameSeries.length) return null;
  const newest = sameSeries.sort((a, b) => Number(table[b]) - Number(table[a]))[0];
  return { pfid: table[newest], exact: false, matched: newest };
}

async function fetchJson(url, timeoutMs) {
  const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), headers: { 'User-Agent': 'Pulso' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// Intenta refrescar la tabla de IDs desde GitHub; si falla, usa la incluida.
async function loadTable() {
  try {
    const remote = await fetchJson(GPU_DATA_URL, 6000);
    if (remote && remote.desktop) return { ...bundled, ...remote.desktop };
  } catch { /* sin internet o GitHub no responde: tabla incluida */ }
  return bundled;
}

async function fetchLatest({ gpuName, osBuild }) {
  try {
    const table = await loadTable();
    const found = findPfid(gpuName, table);
    if (!found) return { ok: false, reason: 'Este modelo de GPU no está en la tabla de NVIDIA.' };
    const osID = Number(osBuild) >= 22000 ? OS_ID.win11 : OS_ID.win10;
    const payload = await fetchJson(`${LOOKUP_URL}?func=DriverManualLookup&pfid=${found.pfid}&osID=${osID}&dch=1`, 10000);
    const info = payload && Number(payload.Success) === 1 && payload.IDS && payload.IDS[0] && payload.IDS[0].downloadInfo;
    if (!info || !info.Version) return { ok: false, reason: 'NVIDIA no devolvió ninguna versión.' };
    return {
      ok: true,
      version: String(info.Version),
      releaseDate: info.ReleaseDateTime || null,
      downloadUrl: info.DownloadURL || null,
      approximate: !found.exact,
      matchedModel: found.matched,
    };
  } catch (e) {
    return { ok: false, reason: e.name === 'TimeoutError' ? 'NVIDIA no respondió a tiempo.' : `No se pudo consultar NVIDIA (${e.message}).` };
  }
}

module.exports = { fetchLatest, findPfid, normalizeGpuName };
