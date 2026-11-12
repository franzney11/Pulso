// Overclock: ¿se puede?, ¿por qué?, ¿qué se puede tocar? y estado actual.
import { html } from '../dom.js';
import { chip, dot, kindOf } from '../components.js';
import { nf } from '../format.js';
import { pageHead, LEVEL, cpuOcChip, ramOcChip } from './shared.js';

const viable = (v) => (v === true ? chip('ok', 'Se puede') : v === false ? chip('bad', 'No') : chip('mute', 'Sin datos'));

function render(s) {
  const o = s.report.overclock;
  const [kind, label] = LEVEL[o.level] || LEVEL.limited;
  const missing = o.factors.filter((f) => f.status === 'unknown' && ['cooling', 'psu'].includes(f.id));
  const { cpuOc, ramOc } = s.report;

  return html`
    ${pageHead('Overclock', 'Una estimación hecha con reglas explícitas, no con IA: cada punto explica por qué sale este veredicto.')}

    <section class="verdict">
      <div>
        <h2 class="verdict-title">${o.title}</h2>
        <p class="verdict-sum">${o.summary}</p>
      </div>
      <div class="scorebar">
        <div class="scorebar-wrap"><div class="scorebar-track"></div><div class="scorebar-pin" style="left:calc(${o.score}% - 1.5px)"></div></div>
        <div class="scorebar-label">${o.score} / 100 · ${chip(kind, label)}</div>
      </div>
    </section>

    ${missing.length ? html`<div class="callout callout--ice" style="margin-top:24px">Faltan datos que Windows no puede leer (${missing.map((f) => f.label.toLowerCase()).join(' y ')}). Indícalos en <button class="btn btn--small" type="button" data-go="equipo">Mi equipo</button> para afinar el veredicto.</div>` : ''}

    <section class="section">
      <h2 class="section-title">Por qué</h2>
      <div>${o.factors.map((f) => html`
        <div class="factor">${dot(kindOf(f.status))}<span class="factor-name">${f.label}</span><span class="factor-detail">${f.detail}</span></div>`)}</div>
    </section>

    <section class="section">
      <h2 class="section-title">Qué se puede tocar</h2>
      <div class="targets">${o.targets.map((t) => html`
        <div class="target"><h4>${t.label} ${viable(t.viable)}</h4><p>${t.note}</p></div>`)}</div>
    </section>

    <section class="section cols">
      <div>
        <h2 class="section-title">Estado actual de la CPU</h2>
        <p style="margin:0 0 8px">${cpuOcChip(cpuOc.status)}</p>
        <p class="note" style="margin:0">${cpuOc.reasons.join(' ')}</p>
      </div>
      <div>
        <h2 class="section-title">Estado actual de la RAM</h2>
        <p style="margin:0 0 8px">${ramOcChip(ramOc.overall)}</p>
        <p class="note" style="margin:0">${ramOc.overall === 'oc' ? 'Algún módulo va por encima de la velocidad que anuncia.' : ramOc.overall === 'below' ? 'Algún módulo va por debajo de la velocidad que anuncia.' : ramOc.overall === 'stock' ? 'Los módulos van a la velocidad que anuncian.' : 'No hay datos suficientes de los módulos.'}</p>
      </div>
    </section>

    <p class="note">Consumo estimado del equipo con la CPU overclockeada: unos ${nf(o.estimatedPeakW)} W en pico. Es una estimación orientativa, no garantiza estabilidad: cualquier overclock real exige pruebas de estrés y vigilar temperaturas y voltajes.</p>`;
}

export default {
  id: 'overclock', label: 'Overclock', group: 2, render,
  dot: (s) => ({ good: 'ok', limited: 'warn', poor: 'bad' }[s.report.summary.level] || null),
};
