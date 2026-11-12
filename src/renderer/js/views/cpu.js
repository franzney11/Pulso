// Procesador: cuentarrevoluciones, frecuencias de fábrica y actuales, estado de overclock,
// núcleos, ficha técnica, driver de chipset y sensores.
import { html, setText, setWidth } from '../dom.js';
import { chip, meter, driverCompare, sensorsHelp } from '../components.js';
import { gaugeSvg, sparkSvg, updateGauge, updateSpark } from '../gauge.js';
import { ghz, ghzRange, gnum, nf, mem, ratio } from '../format.js';
import { byGroup, sensorItems } from '../sensors.js';
import { pageHead, cpuFreq, cpuOcChip, driverRow, driversKey, sensorRowHtml, updateSensorRows } from './shared.js';

const nowText = (lc) => (lc && lc.effectiveMHz ? ghz(lc.effectiveMHz) : '—');
const fastText = (lc) => (lc && lc.maxCoreMHz ? ghz(lc.maxCoreMHz) : '—');

// "Frecuencia actual": un número en vivo, o el rango base → pico medido si está overclockeada.
function actualText(s, f, oc, lc) {
  if (oc.status === 'oc' && f.baseMHz && f.peakMHz) return ghzRange(f.baseMHz, f.peakMHz);
  return nowText(lc);
}

function cpuSensorIdx(s) {
  return ['temps', 'powers', 'voltages'].flatMap((g) => byGroup(s.live, g, 'cpu').map((it) => it.idx));
}

function render(s) {
  const { cpu } = s.snapshot;
  const spec = cpu.spec;
  const f = cpuFreq(s);
  const oc = s.report.cpuOc;
  const lc = s.live && s.live.cpu;
  const threads = cpu.threads || (lc ? lc.perCore.length : 0);
  const cores = lc && lc.perCore.length ? lc.perCore : Array.from({ length: threads }, (_, i) => ({ id: String(i), mhz: null, loadPct: 0 }));
  const sensorsOn = s.live && s.live.sensors && s.live.sensors.available;
  const items = sensorItems(s.live);
  const sensorIdx = cpuSensorIdx(s);
  const hybrid = spec && /\dP\+/.test(spec.arch || '');
  const isOc = oc.status === 'oc';

  const factory = f.known ? ghzRange(f.baseMHz, f.boostMHz) : ghz(f.baseMHz);
  const factorySub = f.known ? 'base – boost máximo' : 'base según Windows (esta CPU no está en la base de datos)';

  return html`
    ${pageHead(cpu.name, [cpu.vendor, spec && spec.arch, cpu.socket].filter(Boolean).join(' · ') || 'Procesador')}

    ${isOc ? html`<div class="callout callout--oc"><b>Overclock detectado.</b> ${oc.reasons[0]}</div>` : ''}

    <div class="cpu-hero">
      <div class="gauge">${gaugeSvg({
        baseMHz: f.baseMHz, boostMHz: f.boostMHz, known: f.known, scaleMax: f.scaleMax,
        mhz: lc ? lc.maxCoreMHz : null, peakMHz: f.peakMHz, nowText: lc && lc.maxCoreMHz ? gnum(lc.maxCoreMHz) : '—',
      })}</div>
      <div>
        <div class="readouts">
          <div class="readout">
            <span class="readout-label">Frecuencia de fábrica</span>
            <span class="readout-val">${factory}</span>
            <span class="readout-label">${factorySub}</span>
          </div>
          <div class="readout">
            <span class="readout-label">Frecuencia actual</span>
            <span class="readout-val" data-k="cpu-actual">${actualText(s, f, oc, lc)}</span>
            <span class="readout-label">${isOc ? 'rango medido, por overclock' : 'media de todos los hilos'}</span>
          </div>
          <div class="readout">
            <span class="readout-label">Núcleo más rápido</span>
            <span class="readout-val" data-k="cpu-fast">${fastText(lc)}</span>
          </div>
          <div class="readout">
            <span class="readout-label">Pico en esta sesión</span>
            <span class="readout-val" data-k="cpu-peak">${f.peakMHz ? ghz(f.peakMHz) : '—'}</span>
          </div>
        </div>
        <p style="margin:18px 0 6px">${cpuOcChip(oc.status)}${isOc ? html` ${chip('oc', `+${nf(oc.deltaMHz)} MHz sobre el boost`)}` : ''}</p>
        <p class="note">${oc.reasons.join(' ')}</p>
        ${hybrid ? html`<p class="note">En CPU híbridas de Intel, las frecuencias de fábrica son las de los núcleos de rendimiento (P).</p>` : ''}
      </div>
    </div>

    <section class="section">
      <h2 class="section-title">Últimos 60 segundos</h2>
      ${sparkSvg()}
      <div class="legend"><span><i style="background:var(--amber)"></i>Frecuencia (núcleo más rápido)</span><span><i style="background:var(--ice)"></i>Carga</span></div>
    </section>

    <section class="section">
      <h2 class="section-title">Hilos</h2>
      <div class="core-grid">
        ${cores.map((c, i) => html`
          <div class="core">
            <div class="core-id">Hilo ${i + 1}</div>
            <div class="core-mhz" data-k="core-${i}">${c.mhz ? ghz(c.mhz) : '—'}</div>
            ${meter(`core-${i}-bar`, c.loadPct, '')}
          </div>`)}
      </div>
    </section>

    <section class="section cols">
      <div>
        <h2 class="section-title">Ficha técnica</h2>
        <dl class="dl">
          <dt>Modelo</dt><dd>${cpu.name}<span class="sub">${cpu.rawName}</span></dd>
          <dt>Núcleos / hilos</dt><dd>${cpu.cores || '—'} / ${cpu.threads || '—'}</dd>
          <dt>Caché</dt><dd>${cpu.l2KB ? `L2 ${mem(cpu.l2KB / 1024)}` : 'L2 —'} · ${cpu.l3KB ? `L3 ${mem(cpu.l3KB / 1024)}` : 'L3 —'}</dd>
          <dt>Socket</dt><dd>${cpu.socket || '—'}</dd>
          <dt>Consumo de diseño (TDP)</dt><dd>${spec ? `${spec.tdpW} W` : '—'}</dd>
          <dt>Multiplicador</dt><dd>${cpu.unlocked === true ? 'Desbloqueado' : cpu.unlocked === false ? 'Bloqueado' : 'No se sabe'}</dd>
        </dl>
      </div>
      <div>
        <h2 class="section-title">Driver del chipset</h2>
        <p class="note" style="margin-top:0">Las CPU no tienen driver propio: lo que se actualiza es el driver del chipset de la placa.</p>
        ${driverCompare(driverRow(s, 'chipset'))}
        <p><button class="btn btn--small" type="button" data-action="check-drivers">Comprobar ahora</button></p>
      </div>
    </section>

    <section class="section">
      <h2 class="section-title">Temperatura, voltaje y consumo</h2>
      ${sensorsOn && sensorIdx.length
        ? html`<div>${sensorIdx.map((idx) => sensorRowHtml('cs-', { ...items[idx], idx }))}</div>`
        : sensorsHelp()}
    </section>`;
}

function mount(root, s, ctx) {
  const f0 = cpuFreq(s);
  const shown = { status: s.report.cpuOc.status, scale: f0.scaleMax, drivers: driversKey(s), sensors: cpuSensorIdx(s).join() };
  return {
    update(next) {
      const f = cpuFreq(next);
      const oc = next.report.cpuOc;
      const now = { status: oc.status, scale: f.scaleMax, drivers: driversKey(next), sensors: cpuSensorIdx(next).join() };
      if (JSON.stringify(now) !== JSON.stringify(shown)) return ctx.rerender();
      const lc = next.live && next.live.cpu;
      if (!lc) return undefined;

      setText(root, 'cpu-actual', actualText(next, f, oc, lc));
      setText(root, 'cpu-fast', fastText(lc));
      setText(root, 'cpu-peak', f.peakMHz ? ghz(f.peakMHz) : '—');
      updateGauge(root, { mhz: lc.maxCoreMHz, peakMHz: f.peakMHz, scaleMax: f.scaleMax, boostMHz: f.boostMHz, loadPct: lc.loadPct });
      updateSpark(root, ctx.hist, f.scaleMax);
      lc.perCore.forEach((c, i) => {
        setText(root, `core-${i}`, c.mhz ? ghz(c.mhz) : '—');
        setWidth(root, `core-${i}-bar`, ratio(c.loadPct, 100));
      });
      updateSensorRows(root, 'cs-', next, cpuSensorIdx(next));
      return undefined;
    },
  };
}

export default {
  id: 'cpu', label: 'Procesador', group: 1, render, mount,
  dot: (s) => (s.report.summary.cpuOc === 'oc' ? 'oc' : null),
};
