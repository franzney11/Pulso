// Cuentarrevoluciones de frecuencia y gráfica de últimos segundos, en SVG a mano.
import { raw, setText } from './dom.js';
import { gnum, nf } from './format.js';

const CX = 180;
const CY = 180;
const START = 135; // grados SVG (0° = derecha, sentido horario): abajo a la izquierda
const SWEEP = 270;
const R = 150;
const rad = (d) => (d * Math.PI) / 180;
const pt = (r, deg) => [CX + r * Math.cos(rad(deg)), CY + r * Math.sin(rad(deg))];
const f = (n) => n.toFixed(2);

function arc(r, a0, a1) {
  const [x0, y0] = pt(r, a0);
  const [x1, y1] = pt(r, a1);
  return `M${f(x0)} ${f(y0)} A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${f(x1)} ${f(y1)}`;
}

// Fondo de escala: boost + margen, o el pico medido si lo supera. Siempre múltiplo de 500 MHz.
export function scaleFor({ baseMHz, boostMHz, peakMHz }) {
  const top = (boostMHz || (baseMHz ? baseMHz * 1.3 : 4000)) + 500;
  return Math.ceil(Math.max(top, (peakMHz || 0) * 1.05) / 500) * 500;
}

export const gaugeAngle = (mhz, scaleMax) => START + Math.min(1, Math.max(0, (mhz || 0) / scaleMax)) * SWEEP;

export function gaugeSvg({ baseMHz, boostMHz, known, scaleMax, mhz, peakMHz, nowText }) {
  const a = (v) => gaugeAngle(v, scaleMax);
  const zone = (cls, from, to) => `<path class="${cls}" d="${arc(R, a(from), a(to))}" fill="none" stroke-width="12"/>`;
  const zones = known
    ? [zone('zone-base', 0, baseMHz), boostMHz > baseMHz ? zone('zone-boost', baseMHz, boostMHz) : '', scaleMax > boostMHz ? zone('zone-oc', boostMHz, scaleMax) : '']
    : [zone('zone-base', 0, scaleMax)];

  let ticks = '';
  for (let v = 0; v <= scaleMax; v += 250) {
    const major = v % 1000 === 0;
    const [x0, y0] = pt(major ? 124 : 130, a(v));
    const [x1, y1] = pt(138, a(v));
    ticks += `<line class="tick${major ? ' tick--major' : ''}" x1="${f(x0)}" y1="${f(y0)}" x2="${f(x1)}" y2="${f(y1)}"/>`;
    if (major) {
      const [lx, ly] = pt(106, a(v));
      ticks += `<text class="tick-label" x="${f(lx)}" y="${f(ly)}">${v / 1000}</text>`;
    }
  }

  const needleDeg = a(mhz);
  const peakDeg = a(peakMHz);
  return raw(`
<svg viewBox="0 0 360 312" role="img" aria-label="Frecuencia actual de la CPU">
  ${zones.join('')}
  ${ticks}
  <g class="peak" data-k="g-peak" style="transform:rotate(${f(peakDeg)}deg)"><path d="M342 174 L342 186 L330 180 Z" fill="var(--text)" opacity=".85"/></g>
  <g class="needle" data-k="g-needle" style="transform:rotate(${f(needleDeg)}deg)"><path d="M180 174.5 L276 180 L180 185.5 Z" fill="var(--amber)"/></g>
  <circle cx="180" cy="180" r="8" fill="var(--amber)"/><circle cx="180" cy="180" r="3.2" fill="var(--panel)"/>
  <text class="readout-big" data-k="g-big" x="180" y="240">${nowText}</text>
  <text class="readout-unit" x="180" y="262">GHz</text>
  <text class="readout-load" data-k="g-load" x="180" y="288"></text>
</svg>`);
}

export function updateGauge(root, { mhz, peakMHz, scaleMax, boostMHz, loadPct }) {
  const needle = root.querySelector('[data-k="g-needle"]');
  const peak = root.querySelector('[data-k="g-peak"]');
  if (needle) {
    needle.style.transform = `rotate(${f(gaugeAngle(mhz, scaleMax))}deg)`;
    needle.classList.toggle('is-oc', !!(boostMHz && mhz && mhz > boostMHz * 1.025));
  }
  if (peak) {
    peak.style.transform = `rotate(${f(gaugeAngle(peakMHz, scaleMax))}deg)`;
    peak.style.opacity = peakMHz ? '1' : '0';
  }
  setText(root, 'g-big', mhz ? gnum(mhz) : '—');
  setText(root, 'g-load', loadPct != null ? `Carga ${nf(loadPct)} %` : '');
}

// ---- Gráfica de los últimos segundos -------------------------------------------------
const W = 300;
const H = 64;

export const sparkSvg = () => raw(`
<svg class="spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Frecuencia y carga de la CPU en los últimos segundos">
  <line class="guide" x1="0" y1="${H / 2}" x2="${W}" y2="${H / 2}" vector-effect="non-scaling-stroke"/>
  <path class="line-load" data-k="sp-load" d="" vector-effect="non-scaling-stroke"/>
  <path class="line-mhz" data-k="sp-mhz" d="" vector-effect="non-scaling-stroke"/>
</svg>`);

function pathOf(values, max, N) {
  if (!values.length) return '';
  const step = W / (N - 1);
  const x0 = W - (values.length - 1) * step;
  return values
    .map((v, i) => `${i ? 'L' : 'M'}${f(x0 + i * step)} ${f(H - 3 - Math.min(1, Math.max(0, (v || 0) / max)) * (H - 6))}`)
    .join('');
}

export function updateSpark(root, hist, scaleMax, N = 60) {
  const set = (key, d) => {
    const el = root.querySelector(`[data-k="${key}"]`);
    if (el && el.getAttribute('d') !== d) el.setAttribute('d', d);
  };
  set('sp-mhz', pathOf(hist.mhz, scaleMax, N));
  set('sp-load', pathOf(hist.load, 100, N));
}
