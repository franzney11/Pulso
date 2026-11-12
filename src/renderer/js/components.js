import { html } from './dom.js';
import { fmtDate } from './format.js';

export const dot = (kind) => html`<span class="dot dot--${kind}" aria-hidden="true"></span>`;
export const chip = (kind, text) => html`<span class="chip chip--${kind}">${text}</span>`;

const w = (pct) => Math.max(0, Math.min(100, Number(pct) || 0)).toFixed(1);
export const meter = (key, pct, kind = '') =>
  html`<div class="meter${kind ? ` meter--${kind}` : ''}"><i data-k="${key}" style="width:${w(pct)}%"></i></div>`;

// Fila "etiqueta · barra · valor". `key` identifica el valor y la barra al actualizar.
export const meterRow = (key, label, pct, text, kind = '') => html`
  <div class="meter-row">
    <span class="label">${label}</span>
    ${meter(`${key}-bar`, pct, kind)}
    <span class="val" data-k="${key}">${text}</span>
  </div>`;

export const STATUS_KIND = { ok: 'ok', warn: 'warn', bad: 'bad', unknown: 'mute' };
export const kindOf = (s) => STATUS_KIND[s] || 'mute';

export const DRIVER_STATUS = {
  outdated: ['warn', 'Hay una versión más nueva'],
  uptodate: ['ok', 'Al día'],
  newer: ['ice', 'Más nueva que la publicada'],
  unknown: ['mute', 'Sin comparar'],
  unavailable: ['mute', 'No se pudo consultar'],
  manual: ['ice', 'Compruébalo en la web'],
};

// Instalado frente a más reciente. Se usa en CPU (chipset), Gráfica y la pestaña Drivers.
export function driverCompare(row) {
  if (!row) return html`<p class="note">Aún no se ha comprobado el driver. Se hace en segundo plano al abrir la app.</p>`;
  const [kind, label] = DRIVER_STATUS[row.status] || DRIVER_STATUS.unknown;
  const latest = row.latest || (row.status === 'manual' ? 'En la web del fabricante' : '—');
  return html`
    <div class="driver-compare">
      <div class="readouts">
        <div class="readout">
          <span class="readout-label">Versión instalada</span>
          <span class="readout-val ${row.installed ? '' : 'readout-val--text'}">${row.installed || 'No encontrada'}</span>
          ${row.installedDate ? html`<span class="readout-label">${fmtDate(row.installedDate)}</span>` : ''}
        </div>
        <div class="readout">
          <span class="readout-label">Más reciente disponible</span>
          <span class="readout-val ${row.latest ? '' : 'readout-val--text'}">${latest}</span>
          ${row.latestDate ? html`<span class="readout-label">${fmtDate(row.latestDate)}</span>` : ''}
        </div>
        <div class="readout">
          <span class="readout-label">Estado</span>
          <span>${chip(kind, label)}</span>
        </div>
      </div>
      ${row.note ? html`<p class="note">${row.note}</p>` : ''}
      ${row.url ? html`<p class="note"><button class="btn btn--small" type="button" data-open="${row.url}">Abrir la página oficial</button></p>` : ''}
    </div>`;
}

// Cuando no hay sensores de placa: cómo activarlos.
export const sensorsHelp = () => html`
  <div class="empty">
    <h3>Faltan los sensores de la placa base</h3>
    <p style="margin:0">Windows no deja leer ventiladores, voltajes ni la mayoría de temperaturas sin un driver especial.
    Pulso se conecta a LibreHardwareMonitor (gratis y de código abierto) para obtenerlos:</p>
    <ol>
      <li>Descarga LibreHardwareMonitor y ábrelo como administrador.</li>
      <li>En el menú <code>Options</code> abre <code>Remote Web Server</code> y pulsa <code>Run</code>.</li>
      <li>Vuelve aquí: los datos aparecen solos en unos segundos.</li>
    </ol>
  </div>`;
