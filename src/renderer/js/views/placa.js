// Placa base: modelo, chipset, BIOS y qué overclock permite el chipset.
import { html } from '../dom.js';
import { chip } from '../components.js';
import { pageHead } from './shared.js';

const yesNo = (v) => (v === true ? chip('ok', 'Sí') : v === false ? chip('bad', 'No') : v === 'limited' ? chip('warn', 'Según el modelo') : chip('mute', 'Sin datos'));

function render(s) {
  const { board, memory } = s.snapshot;
  const caps = s.report.overclock.caps;
  return html`
    ${pageHead(`${board.manufacturer} ${board.model}`.trim() || 'Placa base', board.chipset ? `Chipset ${board.chipset}` : 'No se pudo identificar el chipset')}
    <section class="cols">
      <div>
        <h2 class="section-title">Identificación</h2>
        <dl class="dl">
          <dt>Fabricante</dt><dd>${board.manufacturer || '—'}</dd>
          <dt>Modelo</dt><dd>${board.model || '—'}</dd>
          <dt>Revisión</dt><dd>${board.version || '—'}</dd>
          <dt>Chipset</dt><dd>${board.chipset || '—'}<span class="sub">Deducido del nombre de la placa</span></dd>
          <dt>Ranuras de RAM</dt><dd>${memory.slotsTotal || '—'}</dd>
        </dl>
      </div>
      <div>
        <h2 class="section-title">BIOS</h2>
        <dl class="dl">
          <dt>Versión</dt><dd>${board.bios.version || '—'}</dd>
          <dt>Fecha</dt><dd>${board.bios.date || '—'}</dd>
          <dt>Fabricante de la BIOS</dt><dd>${board.bios.vendor || '—'}</dd>
        </dl>
        <p class="note">Pulso no sabe cuál es la última BIOS de tu placa: mira la web del fabricante desde la pestaña <button class="btn btn--small" type="button" data-go="drivers">Drivers</button></p>
      </div>
    </section>

    <section class="section">
      <h2 class="section-title">Qué permite este chipset</h2>
      ${caps.known
        ? html`<dl class="dl">
            <dt>Overclock de la CPU</dt><dd>${yesNo(caps.cpuOc)}</dd>
            <dt>Overclock de la RAM (XMP/DOCP/EXPO)</dt><dd>${yesNo(caps.ramOc)}</dd>
          </dl>
          ${caps.note ? html`<p class="note">${caps.note}</p>` : ''}
          <p class="note">Esto es lo que permite el chipset. Que una placa concreta lo haga bien también depende de su sistema de alimentación (VRM), algo que Pulso aún no mide.</p>`
        : html`<div class="empty"><h3>Chipset sin reglas</h3><p style="margin:0">${board.chipset ? `Pulso todavía no sabe qué permite el ${board.chipset}.` : 'No se ha podido identificar el chipset a partir del nombre de la placa.'} Se puede añadir en <code>src/main/analysis/overclock.js</code>.</p></div>`}
    </section>`;
}

export default { id: 'placa', label: 'Placa base', group: 1, render, dot: () => null };
