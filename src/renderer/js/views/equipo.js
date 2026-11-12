// Mi equipo: lo que Windows no puede saber (disipador, fuente, caja) y la dirección de los sensores.
import { html, setText } from '../dom.js';
import { pageHead, COOLER_TYPES } from './shared.js';

function render(s) {
  const p = s.profile || {};
  const sel = (v) => (p.coolerType === v ? 'selected' : '');
  return html`
    ${pageHead('Mi equipo', 'Windows no puede saber qué disipador, fuente o caja tienes: no hay ningún chip que lo diga. Cuéntaselo a Pulso y lo usará en la estimación de overclock.')}
    ${s.demo ? html`<div class="callout callout--ice">Estás en modo demo: lo que escribas aquí no se guarda en el disco.</div>` : ''}
    <form class="form" id="profile-form" autocomplete="off">
      <div class="field">
        <label for="f-cooler">Disipador de la CPU</label>
        <input id="f-cooler" name="cooler" type="text" maxlength="80" value="${p.cooler || ''}" placeholder="Por ejemplo: Thermalright Assassin X 120">
      </div>
      <div class="field">
        <label for="f-ctype">Tipo de refrigeración</label>
        <select id="f-ctype" name="coolerType">
          <option value="">Sin indicar</option>
          ${Object.entries(COOLER_TYPES).map(([v, t]) => html`<option value="${v}" ${sel(v)}>${t}</option>`)}
        </select>
        <span class="hint">El disipador de caja que viene con la CPU se queda corto en cuanto subes voltaje.</span>
      </div>
      <div class="field">
        <label for="f-psu">Potencia de la fuente (vatios)</label>
        <input id="f-psu" name="psuWatts" type="number" min="150" max="2000" step="10" value="${p.psuWatts || ''}" placeholder="650">
      </div>
      <div class="field">
        <label for="f-psum">Modelo de la fuente</label>
        <input id="f-psum" name="psuModel" type="text" maxlength="80" value="${p.psuModel || ''}" placeholder="Opcional">
      </div>
      <div class="field">
        <label for="f-case">Caja</label>
        <input id="f-case" name="pcCase" type="text" maxlength="80" value="${p.pcCase || ''}" placeholder="Opcional">
      </div>
      <div class="field">
        <label for="f-lhm">Dirección de LibreHardwareMonitor</label>
        <input id="f-lhm" name="lhmUrl" type="text" value="${p.lhmUrl || ''}">
        <span class="hint">Solo equipos locales (localhost). Es donde Pulso busca los sensores de ventiladores y voltajes.</span>
      </div>
      <div>
        <button class="btn btn--primary" type="submit">Guardar</button>
        <span class="note" data-k="saved" style="margin-left:12px" role="status"></span>
      </div>
    </form>`;
}

function mount(root, s, ctx) {
  const form = root.querySelector('#profile-form');
  if (!form) return null;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    try {
      await ctx.saveProfile(Object.fromEntries(new FormData(form)));
      setText(root, 'saved', 'Guardado. El veredicto de overclock ya usa estos datos.');
    } catch {
      setText(root, 'saved', 'No se pudo guardar.');
    } finally {
      btn.disabled = false;
    }
  });
  return null;
}

export default { id: 'equipo', label: 'Mi equipo', group: 2, render, mount, dot: () => null };
