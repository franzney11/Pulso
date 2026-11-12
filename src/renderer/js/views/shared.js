// Piezas que comparten varias pantallas.
import { html, setText, setWidth } from '../dom.js';
import { chip, meterRow } from '../components.js';
import { scaleFor } from '../gauge.js';
import { deg, rpm, volts, watts, nf, ratio } from '../format.js';
import { sensorItems, tempKind } from '../sensors.js';

export const pageHead = (title, sub, extra = '') => html`
  <header class="page-head">
    <h1 class="page-title">${title}</h1>
    ${sub ? html`<p class="page-sub">${sub}</p>` : ''}
    ${extra}
  </header>`;

// Frecuencias de referencia de la CPU: ficha oficial si existe; si no, solo la base que reporta Windows.
export function cpuFreq(s) {
  const { cpu } = s.snapshot;
  const spec = cpu.spec || null;
  const baseMHz = spec ? spec.baseMHz : cpu.reportedBaseMHz || null;
  const boostMHz = spec ? spec.boostMHz : null;
  const peakMHz = s.session && s.session.peakCpuMHz != null ? s.session.peakCpuMHz : null;
  return { known: !!spec, baseMHz, boostMHz, peakMHz, scaleMax: scaleFor({ baseMHz, boostMHz, peakMHz }) };
}

export const cpuOcChip = (status) =>
  status === 'oc' ? chip('oc', 'Overclockeada') : status === 'stock' ? chip('ok', 'De fábrica') : chip('mute', 'Sin determinar');

export const ramOcChip = (overall) =>
  overall === 'oc' ? chip('oc', 'Overclockeada')
    : overall === 'below' ? chip('warn', 'Por debajo del nominal')
      : overall === 'stock' ? chip('ok', 'Velocidad nominal')
        : chip('mute', 'Sin datos');

export const COOLER_TYPES = { stock: 'Disipador de caja', tower: 'Torre de aire', aio: 'Refrigeración líquida' };

export const LEVEL = { good: ['ok', 'Buen candidato'], limited: ['warn', 'Con límites'], poor: ['bad', 'No compensa'] };

export const driverRow = (s, id) => ((s.report && s.report.drivers) || []).find((d) => d.id === id) || null;
// Huella de los drivers: las pantallas que los muestran se repintan cuando cambia.
export const driversKey = (s) =>
  ((s.report && s.report.drivers) || []).map((d) => `${d.id}:${d.installed}:${d.latest}:${d.status}`).join('|');

// ---- Filas de sensores (ventiladores, temperaturas, voltajes, potencia) -----------------
function sensorDef(it) {
  switch (it.group) {
    case 'temps': return { fmt: deg, pct: (v) => ratio(v, 100), kind: tempKind };
    case 'fans': return { fmt: rpm, pct: (v) => ratio(v, 2500), kind: () => 'ice' };
    case 'voltages': return { fmt: volts, pct: (v) => ratio(v, v > 6 ? 14 : v > 3 ? 6 : 1.6), kind: () => 'ice' };
    case 'powers': return { fmt: watts, pct: (v) => ratio(v, 200), kind: () => '' };
    default: return { fmt: (v) => `${nf(v, 1)} ${it.unit || ''}`.trim(), pct: () => 0, kind: () => '' };
  }
}

export const sensorRowHtml = (prefix, it, label = it.name) => {
  const d = sensorDef(it);
  return meterRow(`${prefix}${it.idx}`, label, d.pct(it.value), d.fmt(it.value), d.kind(it.value));
};

export function updateSensorRows(root, prefix, s, idxs) {
  const items = sensorItems(s.live);
  for (const idx of idxs) {
    const it = items[idx];
    if (!it) continue;
    const d = sensorDef(it);
    setText(root, `${prefix}${idx}`, d.fmt(it.value));
    setWidth(root, `${prefix}${idx}-bar`, d.pct(it.value));
    const bar = root.querySelector(`[data-k="${prefix}${idx}-bar"]`);
    const kind = d.kind(it.value);
    if (bar && bar.parentElement) bar.parentElement.className = `meter${kind ? ` meter--${kind}` : ''}`;
  }
}
