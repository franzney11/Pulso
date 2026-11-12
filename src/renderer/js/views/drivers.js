// Drivers: lo instalado frente a lo más reciente publicado.
import { html } from '../dom.js';
import { chip, DRIVER_STATUS } from '../components.js';
import { fmtDate } from '../format.js';
import { pageHead, driversKey } from './shared.js';

const ver = (v, fallback) => (v ? html`<span class="ver">${v}</span>` : html`<span class="sub">${fallback}</span>`);

function render(s) {
  const rows = s.report.drivers;
  return html`
    ${pageHead('Drivers', 'Versión instalada frente a la más reciente publicada por el fabricante.')}
    ${rows.length ? html`
      <table class="table">
        <thead><tr><th>Componente</th><th>Instalada</th><th>Más reciente</th><th>Estado</th><th></th></tr></thead>
        <tbody>
          ${rows.map((d) => {
            const [kind, label] = DRIVER_STATUS[d.status] || DRIVER_STATUS.unknown;
            return html`<tr>
              <td><span class="comp">${d.component}</span><span class="sub">${d.name}</span></td>
              <td>${ver(d.installed, 'No encontrada')}${d.installedDate ? html`<span class="sub">${fmtDate(d.installedDate)}</span>` : ''}</td>
              <td>${ver(d.latest, 'En la web del fabricante')}${d.latestDate ? html`<span class="sub">${fmtDate(d.latestDate)}</span>` : ''}</td>
              <td>${chip(kind, label)}${d.note ? html`<span class="sub">${d.note}</span>` : ''}</td>
              <td>${d.url ? html`<button class="btn btn--small" type="button" data-open="${d.url}">Abrir web</button>` : ''}</td>
            </tr>`;
          })}
        </tbody>
      </table>`
      : html`<div class="empty"><h3>Comprobando drivers…</h3><p style="margin:0">Se hace en segundo plano al abrir la app. Si tarda, pulsa «Comprobar ahora».</p></div>`}
    <p style="margin-top:20px"><button class="btn btn--primary" type="button" data-action="check-drivers">Comprobar ahora</button></p>
    <p class="note">Solo el driver de las gráficas NVIDIA se compara de forma automática, porque es el único fabricante con una consulta pública. En el resto (chipset, BIOS, AMD, Intel) Pulso muestra lo instalado y abre la página oficial para que compares.</p>`;
}

function mount(root, s, ctx) {
  const shown = driversKey(s);
  return { update: (next) => (driversKey(next) !== shown ? ctx.rerender() : undefined) };
}

export default {
  id: 'drivers', label: 'Drivers', group: 2, render, mount,
  dot: (s) => (s.report.summary.outdatedDrivers > 0 ? 'warn' : null),
};
