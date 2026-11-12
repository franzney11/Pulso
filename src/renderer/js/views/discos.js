// Discos: estado de salud y vida útil estimada (SMART vía Windows).
import { html } from '../dom.js';
import { chip, meter } from '../components.js';
import { diskSize, deg } from '../format.js';
import { pageHead } from './shared.js';

const COLOR = { ok: 'var(--ok)', warn: 'var(--amber)', bad: 'var(--bad)', unknown: 'var(--dim)' };
// Windows entrega el estado en inglés.
const WIN_STATUS = { healthy: 'Sano', warning: 'Aviso', unhealthy: 'No sano' };
const winStatus = (v) => WIN_STATUS[String(v || '').toLowerCase()] || v;

function disk(d, h) {
  const smart = d.smart || {};
  const kind = { ok: 'ok', warn: 'warn', bad: 'bad' }[h.status] || 'mute';
  return html`
    <div class="disk">
      <div>
        <div class="disk-name">${d.name || 'Disco sin nombre'} ${chip('mute', d.type)} ${chip('mute', diskSize(d.sizeGB))}</div>
        <div class="disk-meta">${[d.bus && d.bus !== d.type ? d.bus : null, smart.status ? `Windows dice: ${winStatus(smart.status)}` : null, smart.tempC != null ? deg(smart.tempC) : null].filter(Boolean).join(' · ') || 'Sin más datos'}</div>
        <ul class="disk-notes">${h.notes.map((n) => html`<li>${n}</li>`)}</ul>
      </div>
      <div class="health">
        ${h.score != null
          ? html`<div class="health-label">Vida útil estimada</div>
                 <div class="health-num">${h.score}<small>%</small></div>
                 ${meter(`disk-${d.id}`, h.score, kind)}`
          : html`<div class="health-label">Estado</div>
                 <div class="health-state" style="color:${COLOR[h.status]}">${h.label}</div>`}
      </div>
    </div>`;
}

function render(s) {
  const { disks } = s.snapshot;
  if (!disks.length) {
    return html`${pageHead('Discos', 'No se ha detectado ningún disco.')}<div class="empty"><h3>Sin discos</h3><p style="margin:0">Windows no entregó la lista de discos físicos.</p></div>`;
  }
  return html`
    ${pageHead('Discos', 'La vida útil de un SSD sale de su desgaste; un disco duro no la informa y se juzga por su estado, errores y horas de uso.')}
    <div>${disks.map((d) => disk(d, s.report.disks.find((x) => x.id === d.id) || { status: 'unknown', label: 'Sin datos', score: null, notes: [] }))}</div>
    <p class="note">Son datos SMART tal y como los entrega Windows: sirven para avisar, no para garantizar. Si un disco sale en «Revisar» o «Crítico», haz copia de seguridad antes que nada.</p>`;
}

export default {
  id: 'discos', label: 'Discos', group: 1, render,
  dot: (s) => ({ warn: 'warn', bad: 'bad' }[s.report.summary.worstDisk] || null),
};
