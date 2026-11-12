// Memoria RAM: módulos, velocidad nominal frente a la configurada y si hay overclock.
import { html } from '../dom.js';
import { mem, nf } from '../format.js';
import { pageHead, ramOcChip } from './shared.js';

const scaleOf = (m) => Math.ceil((Math.max(m.ratedMHz || 0, m.configuredMHz || 0) * 1.25) / 200) * 200 || 4000;

function explain(m) {
  const d = m.deltaMHz;
  if (m.status === 'oc') {
    return `Funciona a ${nf(m.configuredMHz)} MHz y el módulo anuncia ${nf(m.ratedMHz)} MHz (+${nf(d)}). Windows no distingue un perfil XMP/DOCP de un ajuste manual: en los dos casos va por encima de lo anunciado.`;
  }
  if (m.status === 'below') return `Va a ${nf(m.configuredMHz)} MHz y el módulo anuncia ${nf(m.ratedMHz)} MHz. Activar XMP/DOCP en la BIOS es el primer paso, sin riesgo.`;
  if (m.status === 'stock') return `Funciona a ${nf(m.configuredMHz)} MHz, la velocidad que anuncia el módulo.`;
  return 'Windows no informa de la velocidad nominal de este módulo.';
}

function moduleCard(m, i) {
  const max = scaleOf(m);
  const fill = Math.min(100, ((m.configuredMHz || 0) / max) * 100);
  const mark = m.ratedMHz ? Math.min(100, (m.ratedMHz / max) * 100) : null;
  return html`
    <div class="module">
      <div>
        <div class="module-name">${m.slot || `Módulo ${i + 1}`} ${ramOcChip(m.status)}</div>
        <dl class="dl" style="margin-top:10px">
          <dt>Capacidad</dt><dd>${mem(m.capacityMB)}${m.type ? ` · ${m.type}` : ''}</dd>
          <dt>Fabricante</dt><dd>${m.manufacturer || '—'}${m.partNumber ? html`<span class="sub">${m.partNumber}</span>` : ''}</dd>
          <dt>Voltaje configurado</dt><dd>${m.voltageV ? `${nf(m.voltageV, 2)} V` : '—'}</dd>
        </dl>
      </div>
      <div>
        <div class="readout-label">Velocidad</div>
        <div class="speed-scale">
          <div class="track"></div>
          <div class="fill${m.status === 'oc' ? ' fill--oc' : ''}" style="width:${fill.toFixed(1)}%"></div>
          ${mark != null ? html`<div class="mark" style="left:${mark.toFixed(1)}%"><span>Nominal ${nf(m.ratedMHz)}</span></div>` : ''}
        </div>
        <p class="note">${explain(m)}</p>
      </div>
    </div>`;
}

function render(s) {
  const { memory } = s.snapshot;
  const ro = s.report.ramOc;
  if (!memory.modules.length) {
    return html`${pageHead('Memoria RAM', 'No se pudieron leer los módulos.')}<div class="empty"><h3>Sin datos de memoria</h3><p style="margin:0">Windows no entregó la lista de módulos. Si pasa siempre, ejecuta <code>npm run probe</code> y revisa el archivo que genera.</p></div>`;
  }
  const single = memory.modules.length === 1 && (memory.slotsTotal || 0) >= 2;
  return html`
    ${pageHead('Memoria RAM',
      `${mem(memory.totalMB)} instalados · ${memory.modules.length} módulo${memory.modules.length === 1 ? '' : 's'}${memory.slotsTotal ? ` de ${memory.slotsTotal} ranuras` : ''}`,
      html`<p style="margin:12px 0 0">${ramOcChip(ro.overall)}</p>`)}
    ${single ? html`<div class="callout callout--ice"><b>Un solo módulo = canal simple.</b> Con dos módulos iguales la memoria trabaja en doble canal, que es la mejora más barata de rendimiento.</div>` : ''}
    <div>${ro.modules.map(moduleCard)}</div>
    <p class="note">Windows y esta pantalla dicen «MHz», pero en DDR son en realidad MT/s: el reloj real es la mitad (DDR4-3200 = 1600 MHz reales). La velocidad nominal es la que anuncia el propio módulo.</p>`;
}

export default {
  id: 'memoria', label: 'Memoria', group: 1, render,
  dot: (s) => ({ oc: 'oc', below: 'warn' }[s.report.summary.ramOc] || null),
};
